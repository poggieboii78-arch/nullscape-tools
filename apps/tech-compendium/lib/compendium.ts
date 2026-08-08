import type { CompendiumData } from "../app/types";
import { starterCompendium } from "../app/types";

type D1Like = {
  prepare(query: string): {
    bind(...values: unknown[]): ReturnType<D1Like["prepare"]>;
    run(): Promise<unknown>;
    all<T>(): Promise<{ results?: T[] }>;
    first<T>(): Promise<T | null>;
  };
  batch(statements: unknown[]): Promise<unknown>;
};

async function db(): Promise<D1Like> {
  const workerRuntime = await import("cloudflare:workers");
  const binding = (workerRuntime.env as unknown as { DB?: D1Like }).DB;
  if (!binding) throw new Error("Compendium database is unavailable.");
  return binding;
}

export async function ensureCompendiumSchema() {
  const d1 = await db();
  await d1.batch([
    d1.prepare(`CREATE TABLE IF NOT EXISTS classes (
      id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
      icon TEXT NOT NULL DEFAULT '✦', description TEXT NOT NULL DEFAULT '',
      accent TEXT NOT NULL DEFAULT '#7770ff', sort_order INTEGER NOT NULL DEFAULT 0,
      published INTEGER NOT NULL DEFAULT 1
    )`),
    d1.prepare(`CREATE TABLE IF NOT EXISTS techs (
      id TEXT PRIMARY KEY, class_id TEXT NOT NULL, slug TEXT NOT NULL,
      title TEXT NOT NULL, summary TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0, published INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL
    )`),
    d1.prepare(`CREATE TABLE IF NOT EXISTS blocks (
      id TEXT PRIMARY KEY, tech_id TEXT NOT NULL, type TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '', url TEXT NOT NULL DEFAULT '',
      caption TEXT NOT NULL DEFAULT '', sort_order INTEGER NOT NULL DEFAULT 0
    )`),
    d1.prepare("CREATE INDEX IF NOT EXISTS techs_class_idx ON techs (class_id, sort_order)"),
    d1.prepare("CREATE INDEX IF NOT EXISTS blocks_tech_idx ON blocks (tech_id, sort_order)"),
  ]);
  const columns = await d1.prepare("PRAGMA table_info(techs)").all<{ name: string }>();
  if (!(columns.results ?? []).some((column) => column.name === "icon")) {
    await d1.prepare("ALTER TABLE techs ADD COLUMN icon TEXT NOT NULL DEFAULT ''").run();
  }
}

async function seedIfEmpty() {
  const d1 = await db();
  const row = await d1.prepare("SELECT COUNT(*) AS count FROM classes").first<{ count: number }>();
  if ((row?.count ?? 0) > 0) return;
  await saveCompendium(starterCompendium, false);
}

export async function loadCompendium(includeDrafts = false): Promise<CompendiumData> {
  await ensureCompendiumSchema();
  await seedIfEmpty();
  const d1 = await db();
  const [classResult, techResult, blockResult] = await Promise.all([
    d1.prepare(`SELECT id, slug, name, icon, description, accent, published
      FROM classes ${includeDrafts ? "" : "WHERE published = 1"} ORDER BY sort_order, name`).all<Record<string, unknown>>(),
    d1.prepare(`SELECT id, class_id, slug, title, icon, summary, published, updated_at
      FROM techs ${includeDrafts ? "" : "WHERE published = 1"} ORDER BY sort_order, title`).all<Record<string, unknown>>(),
    d1.prepare("SELECT id, tech_id, type, content, url, caption FROM blocks ORDER BY sort_order, id").all<Record<string, unknown>>(),
  ]);

  const blocksByTech = new Map<string, CompendiumData["classes"][number]["techs"][number]["blocks"]>();
  for (const row of blockResult.results ?? []) {
    const techId = String(row.tech_id);
    const list = blocksByTech.get(techId) ?? [];
    list.push({
      id: String(row.id), type: String(row.type) as never,
      content: String(row.content ?? ""), url: String(row.url ?? ""), caption: String(row.caption ?? ""),
    });
    blocksByTech.set(techId, list);
  }

  const techsByClass = new Map<string, CompendiumData["classes"][number]["techs"]>();
  for (const row of techResult.results ?? []) {
    const classId = String(row.class_id);
    const list = techsByClass.get(classId) ?? [];
    list.push({
      id: String(row.id), slug: String(row.slug), title: String(row.title), icon: String(row.icon ?? ""),
      summary: String(row.summary ?? ""), published: Boolean(row.published),
      updatedAt: String(row.updated_at), blocks: blocksByTech.get(String(row.id)) ?? [],
    });
    techsByClass.set(classId, list);
  }

  return {
    title: starterCompendium.title,
    subtitle: starterCompendium.subtitle,
    classes: (classResult.results ?? []).map((row) => ({
      id: String(row.id), slug: String(row.slug), name: String(row.name), icon: String(row.icon),
      description: String(row.description ?? ""), accent: String(row.accent ?? "#7770ff"),
      published: Boolean(row.published), techs: techsByClass.get(String(row.id)) ?? [],
    })),
  };
}

export async function saveCompendium(data: CompendiumData, ensure = true) {
  if (ensure) await ensureCompendiumSchema();
  const d1 = await db();
  const statements: unknown[] = [
    d1.prepare("DELETE FROM blocks"),
    d1.prepare("DELETE FROM techs"),
    d1.prepare("DELETE FROM classes"),
  ];
  data.classes.forEach((item, classIndex) => {
    statements.push(d1.prepare(`INSERT INTO classes
      (id, slug, name, icon, description, accent, sort_order, published)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(item.id, item.slug, item.name, item.icon, item.description, item.accent, classIndex, item.published ? 1 : 0));
    item.techs.forEach((tech, techIndex) => {
      statements.push(d1.prepare(`INSERT INTO techs
        (id, class_id, slug, title, icon, summary, sort_order, published, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(tech.id, item.id, tech.slug, tech.title, tech.icon || "", tech.summary, techIndex, tech.published ? 1 : 0, new Date().toISOString()));
      tech.blocks.forEach((block, blockIndex) => {
        statements.push(d1.prepare(`INSERT INTO blocks
          (id, tech_id, type, content, url, caption, sort_order)
          VALUES (?, ?, ?, ?, ?, ?, ?)`)
          .bind(block.id, tech.id, block.type, block.content, block.url, block.caption, blockIndex));
      });
    });
  });
  await d1.batch(statements);
}
