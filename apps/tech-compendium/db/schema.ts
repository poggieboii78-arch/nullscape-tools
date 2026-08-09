import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const classes = sqliteTable("classes", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  icon: text("icon").notNull().default("✦"),
  description: text("description").notNull().default(""),
  accent: text("accent").notNull().default("#7770ff"),
  sortOrder: integer("sort_order").notNull().default(0),
  published: integer("published", { mode: "boolean" }).notNull().default(true),
});

export const techs = sqliteTable("techs", {
  id: text("id").primaryKey(),
  classId: text("class_id").notNull(),
  slug: text("slug").notNull(),
  title: text("title").notNull(),
  icon: text("icon").notNull().default(""),
  summary: text("summary").notNull().default(""),
  sortOrder: integer("sort_order").notNull().default(0),
  published: integer("published", { mode: "boolean" }).notNull().default(true),
  updatedAt: text("updated_at").notNull(),
});

export const blocks = sqliteTable("blocks", {
  id: text("id").primaryKey(),
  techId: text("tech_id").notNull(),
  type: text("type").notNull(),
  content: text("content").notNull().default(""),
  url: text("url").notNull().default(""),
  caption: text("caption").notNull().default(""),
  secondaryUrl: text("secondary_url").notNull().default(""),
  secondaryCaption: text("secondary_caption").notNull().default(""),
  sortOrder: integer("sort_order").notNull().default(0),
});
