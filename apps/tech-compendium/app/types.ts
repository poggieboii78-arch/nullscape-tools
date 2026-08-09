import source from "../data/compendium-data.json";

export type BlockType = "heading" | "paragraph" | "steps" | "callout" | "video" | "video-comparison" | "image" | "metronome";

export type CompendiumBlock = {
  id: string;
  type: BlockType;
  content: string;
  url: string;
  caption: string;
  secondaryUrl?: string;
  secondaryCaption?: string;
  bpm?: number;
  countIn?: number;
  loop?: boolean;
};

export type CompendiumTech = {
  id: string;
  kind?: "tech";
  slug: string;
  title: string;
  icon: string;
  summary: string;
  published: boolean;
  updatedAt: string;
  blocks: CompendiumBlock[];
};

export type CompendiumTechSeparator = {
  id: string;
  kind: "separator";
  title: string;
};

export type CompendiumTechItem = CompendiumTech | CompendiumTechSeparator;

export type CompendiumClass = {
  id: string;
  slug: string;
  name: string;
  icon: string;
  description: string;
  accent: string;
  published: boolean;
  updatedAt?: string;
  techs: CompendiumTechItem[];
};

export type CompendiumData = {
  title: string;
  subtitle: string;
  classes: CompendiumClass[];
  deletedClassIds?: string[];
  classOrderUpdatedAt?: string;
};

const fallbackCompendium: CompendiumData = {
  title: "Nullscape Tech Compendium",
  subtitle: "Class tricks, setups, and little things worth remembering.",
  classes: [
    {
      id: "starter-class",
      slug: "start-here",
      name: "Start here",
      icon: "✦",
      description: "A tiny example class you can replace in the editor.",
      accent: "#7770ff",
      published: true,
      techs: [
        {
          id: "starter-tech",
          slug: "welcome",
          title: "Welcome to the compendium",
          icon: "",
          summary: "Pick a class above, then choose a tech from the list on the left.",
          published: true,
          updatedAt: "2026-08-08T00:00:00.000Z",
          blocks: [
            {
              id: "starter-heading",
              type: "heading",
              content: "Built for quick reminders",
              url: "",
              caption: "",
            },
            {
              id: "starter-paragraph",
              type: "paragraph",
              content: "Use the private editor to replace this example, add class tabs, create tech pages, and arrange text, images, videos, steps, and callouts in any order.",
              url: "",
              caption: "",
            },
            {
              id: "starter-callout",
              type: "callout",
              content: "Nothing on this public page needs an edit button—the whole editing surface lives on its own private site.",
              url: "",
              caption: "",
            },
            {
              id: "starter-metronome",
              type: "metronome",
              content: "Shift + W\nM1\nSpace + M2\nWait",
              url: "",
              caption: "Example input timing",
              bpm: 90,
              countIn: 4,
              loop: true,
            },
          ],
        },
      ],
    },
  ],
};

export const starterCompendium: CompendiumData = Array.isArray(source.classes)
  ? source as unknown as CompendiumData
  : fallbackCompendium;

export function isCompendiumTech(item: CompendiumTechItem): item is CompendiumTech {
  return item.kind !== "separator";
}
