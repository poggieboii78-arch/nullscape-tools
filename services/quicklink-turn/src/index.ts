import { DurableObject } from "cloudflare:workers";

const credentialTtlSeconds = 1800;
const maxRelayMessageBytes = 96 * 1024;
const maxRoomConnections = 32;
const maxRelayMessagesPerMinute = 120;

type TurnCredentials = {
  iceServers: Array<{
    urls: string[];
    username?: string;
    credential?: string;
  }>;
};

function corsHeaders(origin: string): HeadersInit {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

export class QuickLinkRoom extends DurableObject<Env> {
  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return json({ error: "WebSocket upgrade required" }, 426);
    }

    if (this.ctx.getWebSockets().length >= maxRoomConnections) {
      return json({ error: "Room is full" }, 429);
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ windowStartedAt: Date.now(), messages: 0 });

    for (const socket of this.ctx.getWebSockets()) {
      if (socket !== server && socket.readyState === WebSocket.OPEN) {
        socket.send('{"type":"peer-joined"}');
      }
    }

    return new Response(null, { status: 101, webSocket: client });
  }

  webSocketMessage(sender: WebSocket, message: string | ArrayBuffer): void {
    const now = Date.now();
    const saved = sender.deserializeAttachment() as { windowStartedAt?: unknown; messages?: unknown } | null;
    const windowStartedAt = typeof saved?.windowStartedAt === "number" && now - saved.windowStartedAt < 60_000 ? saved.windowStartedAt : now;
    const messages = windowStartedAt === saved?.windowStartedAt && typeof saved.messages === "number" ? saved.messages + 1 : 1;
    sender.serializeAttachment({ windowStartedAt, messages });
    if (messages > maxRelayMessagesPerMinute) {
      sender.close(1008, "Message rate exceeded");
      return;
    }

    const size = typeof message === "string" ? new TextEncoder().encode(message).byteLength : message.byteLength;
    if (size > maxRelayMessageBytes) {
      sender.close(1009, "Message too large");
      return;
    }

    for (const socket of this.ctx.getWebSockets()) {
      if (socket !== sender && socket.readyState === WebSocket.OPEN) socket.send(message);
    }
  }
}

function isAllowedOrigin(origin: string, configuredOrigins: string): boolean {
  const allowed = configuredOrigins
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return allowed.includes(origin);
}

function isTurnCredentials(value: unknown): value is TurnCredentials {
  if (!value || typeof value !== "object") return false;
  const iceServers = (value as { iceServers?: unknown }).iceServers;
  if (!Array.isArray(iceServers) || iceServers.length === 0) return false;
  return iceServers.every((server) => {
    if (!server || typeof server !== "object") return false;
    const candidate = server as Record<string, unknown>;
    return (
      Array.isArray(candidate.urls) &&
      candidate.urls.length > 0 &&
      candidate.urls.every((url) => typeof url === "string") &&
      (candidate.username === undefined || typeof candidate.username === "string") &&
      (candidate.credential === undefined || typeof candidate.credential === "string")
    );
  });
}

function json(body: unknown, status: number, origin?: string): Response {
  return Response.json(body, {
    status,
    headers: origin ? corsHeaders(origin) : undefined,
  });
}

async function anonymousUsageId(request: Request, secret: string): Promise<string> {
  const clientIp = request.headers.get("CF-Connecting-IP") ?? "unknown";
  const bytes = new TextEncoder().encode(`${secret}:${clientIp}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
}

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health" && request.method === "GET") {
      return json({ ok: true }, 200);
    }

    if (url.pathname === "/quicklink") {
      const origin = request.headers.get("Origin") ?? "";
      if (!origin || !isAllowedOrigin(origin, env.ALLOWED_ORIGINS)) {
        return json({ error: "Origin not allowed" }, 403);
      }
      const room = url.searchParams.get("room") ?? "";
      if (!/^[A-Za-z0-9_-]{16}$/.test(room)) return json({ error: "Invalid room" }, 400, origin);
      if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
        return json({ error: "WebSocket upgrade required" }, 426, origin);
      }
      const clientIp = request.headers.get("CF-Connecting-IP") ?? "unknown";
      const [visitorLimit, serviceLimit] = await Promise.all([
        env.RELAY_VISITOR_RATE_LIMITER.limit({ key: clientIp }),
        env.RELAY_SERVICE_RATE_LIMITER.limit({ key: "quicklink-relay" }),
      ]);
      if (!visitorLimit.success || !serviceLimit.success) {
        const response = json({ error: "Too many relay connections" }, 429, origin);
        response.headers.set("Retry-After", "60");
        return response;
      }
      return env.QUICKLINK_ROOMS.getByName(room).fetch(request);
    }

    if (url.pathname !== "/turn-credentials") {
      return json({ error: "Not found" }, 404);
    }

    const origin = request.headers.get("Origin") ?? "";
    if (!origin || !isAllowedOrigin(origin, env.ALLOWED_ORIGINS)) {
      return json({ error: "Origin not allowed" }, 403);
    }

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, 405, origin);
    }

    try {
      const clientIp = request.headers.get("CF-Connecting-IP") ?? "unknown";
      const [visitorLimit, serviceLimit] = await Promise.all([
        env.VISITOR_RATE_LIMITER.limit({ key: clientIp }),
        env.SERVICE_RATE_LIMITER.limit({ key: "turn-credentials" }),
      ]);
      if (!visitorLimit.success || !serviceLimit.success) {
        console.warn(JSON.stringify({
          event: "turn_credentials_rate_limited",
          scope: !visitorLimit.success ? "visitor" : "service",
        }));
        const response = json({ error: "Too many credential requests" }, 429, origin);
        response.headers.set("Retry-After", "60");
        return response;
      }

      const customIdentifier = await anonymousUsageId(request, env.TURN_KEY_SECRET);
      const response = await fetch(
        `https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(env.TURN_KEY_ID)}/credentials/generate-ice-servers`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${env.TURN_KEY_SECRET}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ttl: credentialTtlSeconds,
            customIdentifier,
          }),
        },
      );

      const payload: unknown = await response.json();
      if (!response.ok || !isTurnCredentials(payload)) {
        console.error(JSON.stringify({
          event: "turn_credentials_failed",
          upstreamStatus: response.status,
        }));
        return json({ error: "Could not generate TURN credentials" }, 502, origin);
      }

      const iceServers = payload.iceServers
        .map((server) => ({
          ...server,
          urls: server.urls.filter((url) => !/:53(?:[/?]|$)/.test(url)),
          ...(server.credential ? { credentialType: "password" as const } : {}),
        }))
        .filter((server) => server.urls.length > 0);
      return json({
        ttl: credentialTtlSeconds,
        iceServers,
      }, 200, origin);
    } catch (error) {
      console.error(JSON.stringify({
        event: "turn_credentials_error",
        error: error instanceof Error ? error.message : "Unknown error",
      }));
      return json({ error: "Could not generate TURN credentials" }, 502, origin);
    }
  },
} satisfies ExportedHandler<Env>;
