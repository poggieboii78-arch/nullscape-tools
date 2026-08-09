import { mergeClasses, newestClasses } from "../../class-merge.mjs";
import type { CompendiumClass, CompendiumData } from "../../types";
import { starterCompendium } from "../../types";

export const dynamic = "force-dynamic";

const owner = "poggieboii78-arch";
const repo = "nullscape-tools";
const path = "apps/tech-compendium/data/compendium-data.json";
const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
const maxCommitAttempts = 3;

type GitHubFile = { content: string; sha: string };
type PublishPayload = {
  classes?: CompendiumClass[];
  classOrder?: string[];
  data?: CompendiumData;
};

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

function configured() {
  return Boolean(process.env.GITHUB_TOKEN);
}

function decodeContent(value: string) {
  return decodeURIComponent(escape(atob(value.replace(/\n/g, ""))));
}

function encodeContent(value: string) {
  return btoa(unescape(encodeURIComponent(value)));
}

function validClasses(value: unknown): value is CompendiumClass[] {
  return Array.isArray(value) && value.every((item) => item && typeof item === "object" && typeof (item as CompendiumClass).id === "string" && Array.isArray((item as CompendiumClass).techs));
}

async function readShared(): Promise<{ data: CompendiumData; sha: string }> {
  const response = await fetch(`${apiUrl}?ref=main`, { headers: githubHeaders(), cache: "no-store" });
  if (!response.ok) throw new Error(`GitHub returned ${response.status}.`);
  const file = await response.json() as GitHubFile;
  const data = JSON.parse(decodeContent(file.content)) as CompendiumData;
  if (!data || !Array.isArray(data.classes)) throw new Error("The shared Compendium file is invalid.");
  return { data, sha: file.sha };
}

async function writeShared(data: CompendiumData, sha: string, message: string) {
  return fetch(apiUrl, {
    method: "PUT",
    headers: githubHeaders(true),
    body: JSON.stringify({
      message,
      content: encodeContent(`${JSON.stringify(data, null, 2)}\n`),
      sha,
      branch: "main",
    }),
  });
}

async function commitMerged(
  change: (current: CompendiumData) => CompendiumData | null,
  message: string,
): Promise<{ data: CompendiumData; version: string }> {
  for (let attempt = 0; attempt < maxCommitAttempts; attempt += 1) {
    const current = await readShared();
    const data = change(current.data);
    if (!data) return { data: current.data, version: current.sha };
    const response = await writeShared(data, current.sha, message);
    if (response.ok) {
      const result = await response.json() as { content?: { sha?: string } };
      return { data, version: result.content?.sha ?? current.sha };
    }
    if (response.status !== 409 && response.status !== 422) {
      throw new Error(`GitHub could not publish this update (${response.status}).`);
    }
  }
  throw new Error("The Compendium changed repeatedly while publishing. Please try once more.");
}

export async function GET() {
  if (!configured()) return Response.json({ data: starterCompendium, connected: false });
  try {
    const shared = await readShared();
    return Response.json({ data: shared.data, version: shared.sha, connected: true });
  } catch (error) {
    return Response.json({ data: starterCompendium, connected: false, error: error instanceof Error ? error.message : "Unable to connect." });
  }
}

export async function PUT(request: Request) {
  if (!configured()) return Response.json({ error: "The GitHub publishing secret is not configured." }, { status: 503 });
  try {
    const payload = await request.json() as PublishPayload;
    // `data.classes` keeps already-open copies of the previous editor safe during rollout.
    const incoming = payload.classes ?? payload.data?.classes;
    const classOrder = payload.classOrder;
    if (!validClasses(incoming) || (classOrder !== undefined && !Array.isArray(classOrder))) {
      return Response.json({ error: "Invalid Compendium class update." }, { status: 400 });
    }
    const receivedAt = new Date().toISOString();
    const stamped = incoming.map((item) => ({ ...item, updatedAt: receivedAt }));
    const result = await commitMerged((current) => {
      const deletedClassIds = [...new Set(current.deletedClassIds ?? [])];
      const newest = newestClasses(current.classes, stamped.filter((item) => !deletedClassIds.includes(item.id)));
      const currentOrderTime = Date.parse(current.classOrderUpdatedAt ?? "");
      const receivedTime = Date.parse(receivedAt);
      const acceptedOrder = classOrder && (!Number.isFinite(currentOrderTime) || receivedTime >= currentOrderTime) ? classOrder : undefined;
      if (!newest.length && !acceptedOrder) return null;
      return {
        ...current,
        classes: mergeClasses(current.classes, newest, acceptedOrder, deletedClassIds),
        ...(acceptedOrder ? { classOrderUpdatedAt: receivedAt } : {}),
        ...(deletedClassIds.length ? { deletedClassIds } : {}),
      };
    }, incoming.length === 1 ? `Update ${incoming[0].name} Compendium class` : "Merge Compendium class updates");
    return Response.json({ ok: true, data: result.data, version: result.version });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to publish Compendium classes." }, { status: 502 });
  }
}

export async function DELETE(request: Request) {
  if (!configured()) return Response.json({ error: "The GitHub publishing secret is not configured." }, { status: 503 });
  try {
    const payload = await request.json() as { classId?: string };
    const classId = payload.classId?.trim();
    if (!classId) return Response.json({ error: "Choose a class to delete." }, { status: 400 });
    const result = await commitMerged((current) => ({
      ...current,
      classes: current.classes.filter((item) => item.id !== classId),
      deletedClassIds: [...new Set([...(current.deletedClassIds ?? []), classId])],
    }), "Delete Compendium class");
    return Response.json({ ok: true, data: result.data, version: result.version });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to delete that Compendium class." }, { status: 502 });
  }
}
