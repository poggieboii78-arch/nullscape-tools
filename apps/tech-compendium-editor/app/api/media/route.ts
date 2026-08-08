function connection() {
  return { origin: process.env.COMPENDIUM_ORIGIN?.replace(/\/$/, "") ?? "", token: process.env.COMPENDIUM_EDITOR_TOKEN ?? "" };
}

export async function POST(request: Request) {
  const { origin, token } = connection();
  if (!origin || !token) return Response.json({ error: "The editor is not connected." }, { status: 503 });
  const response = await fetch(`${origin}/api/media`, { method: "POST", headers: { "x-compendium-editor-token": token }, body: await request.formData() });
  return new Response(response.body, { status: response.status, headers: { "content-type": response.headers.get("content-type") || "application/json" } });
}

export async function GET(request: Request) {
  const { origin } = connection();
  if (!origin) return new Response("Not found", { status: 404 });
  const key = new URL(request.url).searchParams.get("key");
  if (!key) return new Response("Not found", { status: 404 });
  const response = await fetch(`${origin}/api/media?key=${encodeURIComponent(key)}`);
  return new Response(response.body, { status: response.status, headers: { "content-type": response.headers.get("content-type") || "application/octet-stream", "cache-control": "public, max-age=31536000, immutable" } });
}
