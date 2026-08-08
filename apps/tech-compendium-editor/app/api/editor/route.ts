import type { CompendiumData } from "../../types";
import { starterCompendium } from "../../types";

export const dynamic = "force-dynamic";

function connection() {
  return {
    origin: process.env.COMPENDIUM_ORIGIN?.replace(/\/$/, "") ?? "",
    token: process.env.COMPENDIUM_EDITOR_TOKEN ?? "",
    bearer: process.env.COMPENDIUM_SITE_BEARER ?? "",
  };
}

function headers(token: string, bearer: string, json = false) {
  return {
    ...(json ? { "content-type": "application/json" } : {}),
    "x-compendium-editor-token": token,
    ...(bearer ? { "OAI-Sites-Authorization": `Bearer ${bearer}` } : {}),
  };
}

export async function GET() {
  const { origin, token, bearer } = connection();
  if (!origin || !token) return Response.json({ data: starterCompendium, connected: false });
  try {
    const response = await fetch(`${origin}/api/compendium`, { headers: headers(token, bearer), cache: "no-store" });
    if (!response.ok) throw new Error(`The compendium returned ${response.status}.`);
    return Response.json({ data: await response.json(), connected: true });
  } catch (error) {
    return Response.json({ data: starterCompendium, connected: false, error: error instanceof Error ? error.message : "Unable to connect." });
  }
}

export async function PUT(request: Request) {
  const { origin, token, bearer } = connection();
  if (!origin || !token) return Response.json({ error: "The editor is not connected to the compendium yet." }, { status: 503 });
  const data = await request.json() as CompendiumData;
  const response = await fetch(`${origin}/api/compendium`, {
    method: "PUT",
    headers: headers(token, bearer, true),
    body: JSON.stringify(data),
  });
  const text = await response.text();
  try {
    const payload = text ? JSON.parse(text) : {};
    return Response.json(payload, { status: response.status });
  } catch {
    return Response.json(
      { error: `The compendium could not finish publishing (${response.status}). Please try again.` },
      { status: response.ok ? 502 : response.status },
    );
  }
}
