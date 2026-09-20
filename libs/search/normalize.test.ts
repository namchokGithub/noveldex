import { describe, expect, it } from "vitest";
import type { Adaptation, Chapter, Novel } from "@/app/types";
import type { Entity } from "@/libs/entities/types";
import {
  normalizeAdaptation,
  normalizeChapter,
  normalizeEntity,
  normalizeNote,
  normalizeNovel,
} from "./normalize";

const labels = {
  chapter: "Chapter",
  prologue: "Prologue",
  epilogue: "Epilogue",
  afterword: "Afterword",
  side_story: "Side Story",
  other: "Other",
};
const rimuru: Entity = {
  id: "novel-1:character:c1",
  novelId: "novel-1",
  type: "character",
  name: "Rimuru",
  aliases: ["Satoru"],
  description: "",
};

const chapter: Chapter = {
  id: "c1",
  volume_id: "v1",
  number: 1,
  sort_order: 1,
  kind: "chapter",
  custom_label: null,
  title: "Awakening",
  title_en: "Awakening",
  title_th: "",
  summary: "",
  description: "",
  notes: [],
  read_at: null,
  tags: [],
  created_at: "",
  updated_at: "",
};

describe("search normalizers", () => {
  it("creates stable routes and identities", () => {
    const novel: Novel = {
      id: "novel-1",
      title: "Tensura",
      author: "Fuse",
      status: "reading",
      description: "",
      cover_url: "",
      volume_count: 0,
      chapter_count: 0,
      read_count: 0,
      created_at: "",
      updated_at: "",
    };
    expect(normalizeNovel(novel)).toMatchObject({
      id: "novel:novel-1",
      route: "/novels/novel-1",
    });
    expect(normalizeEntity(rimuru).route).toBe("/novels/novel-1/characters/c1");
  });

  it("projects current entity data while retaining authored note content", () => {
    const note = {
      id: "n1",
      content: "[[Rimuru]] appears",
      references: [
        {
          start: 0,
          length: 10,
          raw: "[[Rimuru]]",
          token: {
            status: "resolved" as const,
            reference: {
              entityId: rimuru.id,
              entityType: "character" as const,
              label: "Rimuru",
            },
          },
        },
      ],
      created_at: "",
      updated_at: "",
    };
    const document = normalizeNote(
      "novel-1",
      "v1",
      "c1",
      note,
      [],
      new Map([[rimuru.id, { ...rimuru, name: "Rimuru Tempest" }]]),
    );
    expect(document.content).toBe("[[Rimuru]] appears");
    expect(document.referenceNames).toEqual(["Rimuru Tempest"]);
    expect(document.aliases).toEqual(["Satoru"]);
    expect(document.id).toBe("note:novel-1:v1:c1:n1");
  });

  it("does not duplicate note content in chapter documents", () => {
    const document = normalizeChapter(
      "novel-1",
      {
        ...chapter,
        notes: [
          { id: "n1", content: "private note", created_at: "", updated_at: "" },
        ],
      },
      new Map(),
      labels,
    );
    expect(document.content).toBeUndefined();
    expect(document.name).toContain("Awakening");
  });

  it("gives adaptations a stable hash route and volume context", () => {
    const adaptation: Adaptation = {
      id: "a1",
      novel_id: "novel-1",
      volume_id: "v1",
      medium: "anime",
      group_label: "Season 1",
      group_sort_order: 1,
      entry_type: "episode",
      entry_number: 2,
      title: "Awakening",
      source_url: null,
      source_img_url: null,
      description: "A decisive episode.",
      notes: [],
      adapted_chapter_ids: [],
      sort_order: 2,
      created_at: "",
      updated_at: "",
    };

    const document = normalizeAdaptation(adaptation, {
      id: "v1",
      novel_id: "novel-1",
      number: 3,
      title: "Demon Lord",
      title_en: "Demon Lord",
      title_th: "",
      description: "",
    });

    expect(document).toMatchObject({
      id: "adaptation:novel-1:v1:a1",
      type: "adaptation",
      volumeId: "v1",
      route: "/novels/novel-1/adaptations#adaptation-a1",
      title: "Awakening",
      content: "anime Season 1 episode 2 Volume 3 Demon Lord",
    });
  });
});
