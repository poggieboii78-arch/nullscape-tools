type Bucket = { put(key: string, value: ArrayBuffer, options?: { httpMetadata?: { contentType?: string } }): Promise<unknown>; get(key: string): Promise<{ body: ReadableStream; httpMetadata?: { contentType?: string } } | null> };
const allowed = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

function isEditor(request: Request) {
  const expected = process.env.COMPENDIUM_EDITOR_TOKEN;
  return Boolean(expected && request.headers.get("x-compendium-editor-token") === expected);
}

async function bucket() {
  const workerRuntime = await import("cloudflare:workers");
  return (workerRuntime.env as unknown as { BUCKET: Bucket }).BUCKET;
}

export async function POST(request: Request) {
  if (!isEditor(request)) return Response.json({ error: "Not allowed." }, { status: 403 });
  const form = await request.formData(); const file = form.get("file");
  if (!(file instanceof File) || !allowed.has(file.type)) return Response.json({ error: "Choose a PNG, JPG, WebP, or GIF image." }, { status: 400 });
  if (file.size > 5 * 1024 * 1024) return Response.json({ error: "Icons must be 5 MB or smaller." }, { status: 413 });
  const ext = file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1];
  const key = `icons/${crypto.randomUUID()}.${ext}`;
  const storage = await bucket();
  await storage.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: file.type } });
  return Response.json({ url: `/api/media?key=${encodeURIComponent(key)}` });
}

export async function GET(request: Request) {
  const key = new URL(request.url).searchParams.get("key") || "";
  if (!key.startsWith("icons/")) return new Response("Not found", { status: 404 });
  const storage = await bucket(); const object = await storage.get(key);
  if (!object) return new Response("Not found", { status: 404 });
  return new Response(object.body, { headers: { "content-type": object.httpMetadata?.contentType || "application/octet-stream", "cache-control": "public, max-age=31536000, immutable" } });
}
