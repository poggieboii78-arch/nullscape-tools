import { loadCompendium, saveCompendium } from "../../../lib/compendium";
import type { CompendiumData } from "../../types";

export const dynamic = "force-dynamic";

function isEditor(request: Request) {
  const expected = process.env.COMPENDIUM_EDITOR_TOKEN;
  const supplied = request.headers.get("x-compendium-editor-token");
  return Boolean(expected && supplied && expected === supplied);
}

export async function GET(request: Request) {
  try {
    const data = await loadCompendium(isEditor(request));
    return Response.json(data, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to load compendium." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  if (!isEditor(request)) return Response.json({ error: "Not allowed." }, { status: 403 });
  try {
    const payload = await request.json() as CompendiumData;
    if (!payload || !Array.isArray(payload.classes)) {
      return Response.json({ error: "Invalid compendium data." }, { status: 400 });
    }
    await saveCompendium(payload);
    return Response.json({ ok: true, data: await loadCompendium(true) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to save compendium." }, { status: 500 });
  }
}
