const credentialTtlSeconds = 3600;

type TurnCredentials = {
  iceServers: {
    urls: string[];
    username: string;
    credential: string;
  };
};

function corsHeaders(origin: string): HeadersInit {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
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
  if (!iceServers || typeof iceServers !== "object") return false;
  const candidate = iceServers as Record<string, unknown>;
  return (
    Array.isArray(candidate.urls) &&
    candidate.urls.every((url) => typeof url === "string") &&
    typeof candidate.username === "string" &&
    typeof candidate.credential === "string"
  );
}

function json(body: unknown, status: number, origin?: string): Response {
  return Response.json(body, {
    status,
    headers: origin ? corsHeaders(origin) : undefined,
  });
}

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health" && request.method === "GET") {
      return json({ ok: true }, 200);
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
      const response = await fetch(
        `https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(env.TURN_KEY_ID)}/credentials/generate`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${env.TURN_KEY_SECRET}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ttl: credentialTtlSeconds }),
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

      const urls = payload.iceServers.urls.filter((turnUrl) => !turnUrl.includes(":53"));
      return json({
        ttl: credentialTtlSeconds,
        iceServers: [{
          urls,
          username: payload.iceServers.username,
          credential: payload.iceServers.credential,
          credentialType: "password",
        }],
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
