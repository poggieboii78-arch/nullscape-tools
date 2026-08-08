import type { CompendiumData } from "../../types";
import { starterCompendium } from "../../types";

export const dynamic = "force-dynamic";

const owner = "poggieboii78-arch";
const repo = "nullscape-tools";
const path = "apps/tech-compendium/data/compendium-data.json";

function githubHeaders(json = false) {
  const token = process.env.GITHUB_TOKEN ?? "";
  return {
    accept: "application/vnd.github+json",
    authorization: `Bearer ${token}`,
    "x-github-api-version": "2022-11-28",
    ...(json ? { "content-type": "application/json" } : {}),
  };
}

function configured() {
  return Boolean(process.env.GITHUB_TOKEN);
}

function decodeContent(value: string) {
  return decodeURIComponent(escape(atob(value.replace(/\n/g, ""))));
}

function encodeContent(value: string) {
  return btoa(unescape(encodeURIComponent(value)));
}

export async function GET() {
  if (!configured()) return Response.json({ data: starterCompendium, connected: false });
  try {
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=main`, { headers: githubHeaders(), cache: "no-store" });
    if (!response.ok) throw new Error(`GitHub returned ${response.status}.`);
    const file = await response.json() as { content: string; sha: string };
    return Response.json({ data: JSON.parse(decodeContent(file.content)), version: file.sha, connected: true });
  } catch (error) {
    return Response.json({ data: starterCompendium, connected: false, error: error instanceof Error ? error.message : "Unable to connect." });
  }
}

export async function PUT(request: Request) {
  if (!configured()) return Response.json({ error: "The GitHub publishing secret is not configured." }, { status: 503 });
  const payload = await request.json() as { data?: CompendiumData; version?: string };
  if (!payload.data || !Array.isArray(payload.data.classes) || !payload.version) return Response.json({ error: "Invalid or stale compendium data." }, { status: 400 });
  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
    method: "PUT", headers: githubHeaders(true), body: JSON.stringify({
      message: "Update Compendium content",
      content: encodeContent(`${JSON.stringify(payload.data, null, 2)}\n`),
      sha: payload.version,
      branch: "main",
    }),
  });
  if (response.status === 409 || response.status === 422) return Response.json({ error: "A newer version was published elsewhere. Reload before publishing again.", conflict: true }, { status: 409 });
  if (!response.ok) return Response.json({ error: `GitHub could not publish this update (${response.status}).` }, { status: 502 });
  const result = await response.json() as { content?: { sha?: string } };
  return Response.json({ ok: true, data: payload.data, version: result.content?.sha });
}
