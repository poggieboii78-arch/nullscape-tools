export const dynamic = "force-dynamic";

const owner = "poggieboii78-arch";
const repo = "nullscape-tools";
const publicBaseUrl = "https://poggieboii78-arch.github.io/nullscape-tools/compendium/uploads";
const maxMediaBytes = 15 * 1024 * 1024;

const mediaExtensions: Record<string, string> = {
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/ogg": "ogv",
  "image/gif": "gif",
};

function connection() {
  return { origin: process.env.COMPENDIUM_ORIGIN?.replace(/\/$/, "") ?? "", token: process.env.COMPENDIUM_EDITOR_TOKEN ?? "" };
}

function githubHeaders(json = false) {
  const token = process.env.GITHUB_TOKEN ?? "";
  return {
    accept: "application/vnd.github+json",
    authorization: `Bearer ${token}`,
    "user-agent": "nullscape-compendium-editor",
    "x-github-api-version": "2022-11-28",
    ...(json ? { "content-type": "application/json" } : {}),
  };
}

function encodeBytes(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

function safeBlockId(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return "";
  return value.trim().replace(/[^a-z0-9_-]/gi, "-").slice(0, 120);
}

export async function POST(request: Request) {
  const form = await request.formData();
  const upload = form.get("video");
  const { origin, token } = connection();
  if (!(upload instanceof File)) {
    if (!origin || !token) return Response.json({ error: "The editor is not connected." }, { status: 503 });
    const response = await fetch(`${origin}/api/media`, { method: "POST", headers: { "x-compendium-editor-token": token }, body: form });
    return new Response(response.body, { status: response.status, headers: { "content-type": response.headers.get("content-type") || "application/json" } });
  }
  if (!process.env.GITHUB_TOKEN) return Response.json({ error: "The GitHub publishing secret is not configured." }, { status: 503 });

  const blockId = safeBlockId(form.get("blockId"));
  if (!(upload instanceof File) || !blockId) return Response.json({ error: "Choose a video or GIF file and try again." }, { status: 400 });

  const extension = mediaExtensions[upload.type];
  if (!extension) return Response.json({ error: "Use an MP4, WebM, Ogg, or GIF file." }, { status: 415 });
  if (!upload.size || upload.size > maxMediaBytes) return Response.json({ error: "Videos and GIFs must be 15 MB or smaller." }, { status: 413 });

  const filename = `${blockId}.${extension}`;
  const path = `apps/tech-compendium/public/uploads/${filename}`;
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;

  let existingSha: string | undefined;
  const existing = await fetch(`${apiUrl}?ref=main`, { headers: githubHeaders(), cache: "no-store" });
  if (existing.ok) {
    const current = await existing.json() as { sha?: string };
    existingSha = current.sha;
  } else if (existing.status !== 404) {
    return Response.json({ error: `GitHub could not check that video (${existing.status}).` }, { status: 502 });
  }

  const response = await fetch(apiUrl, {
    method: "PUT",
    headers: githubHeaders(true),
    body: JSON.stringify({
      message: existingSha ? "Replace Compendium media" : "Upload Compendium media",
      content: encodeBytes(await upload.arrayBuffer()),
      branch: "main",
      ...(existingSha ? { sha: existingSha } : {}),
    }),
  });

  if (!response.ok) return Response.json({ error: `GitHub could not upload that video (${response.status}).` }, { status: 502 });
  return Response.json({ url: `${publicBaseUrl}/${filename}` });
}

export async function GET(request: Request) {
  const { origin } = connection();
  if (!origin) return new Response("Not found", { status: 404 });
  const key = new URL(request.url).searchParams.get("key");
  if (!key) return new Response("Not found", { status: 404 });
  const response = await fetch(`${origin}/api/media?key=${encodeURIComponent(key)}`);
  return new Response(response.body, { status: response.status, headers: { "content-type": response.headers.get("content-type") || "application/octet-stream", "cache-control": "public, max-age=31536000, immutable" } });
}
