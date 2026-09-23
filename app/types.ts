import type { ReferenceOccurrence } from "@/libs/entities/references";
import type { RichNoteDocument } from "@/libs/richNotes/document";

export interface Novel {
  id: string;
  title: string;
  author: string;
  status: "reading" | "completed" | "dropped" | "on_hold";
  description: string;
  cover_url: string;
  volume_count: number;
  character_count: number;
  chapter_count: number;
  read_count: number;
  created_at: string;
  updated_at: string;
}

export interface Volume {
  id: string;
  novel_id: string;
  number: number;
  title: string;
  title_en: string;
  title_th: string;
  description: string;
  source_img_url: string | null;
  chapter_count: number;
  read_count: number;
  adaptation_count: number;
  event_count: number;
  created_at: string;
  updated_at: string;
}

export const ADAPTATION_MEDIA = [
  "anime",
  "manga",
  "movie",
  "ova",
  "special",
  "game",
  "other",
] as const;

export const ADAPTATION_ENTRY_TYPES = [
  "episode",
  "chapter",
  "volume",
  "movie",
  "special",
] as const;

export type AdaptationMedium = (typeof ADAPTATION_MEDIA)[number];
export type AdaptationEntryType = (typeof ADAPTATION_ENTRY_TYPES)[number];

export interface Adaptation {
  id: string;
  novel_id: string;
  volume_id: string;
  medium: AdaptationMedium;
  group_label: string;
  group_sort_order: number;
  entry_type: AdaptationEntryType;
  entry_number: number;
  title: string;
  source_url: string | null;
  source_img_url: string | null;
  description: string;
  notes: ChapterNote[];
  adapted_chapter_ids: string[];
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export type AdaptationOrderEntry = Pick<Adaptation, "id" | "sort_order">;

export interface PaginationMeta {
  page: number;
  per_page: number;
  total_items: number;
  total_pages: number;
}

export interface VolumeListSummary {
  total_volumes: number;
  total_chapters: number;
  read_count: number;
}

export interface PaginatedVolumes {
  items: Volume[];
  pagination: PaginationMeta;
  summary: VolumeListSummary;
}

export interface Tag {
  id: string;
  novel_id: string;
  name: string;
}

export type ChapterKind =
  | "chapter"
  | "prologue"
  | "epilogue"
  | "afterword"
  | "side_story"
  | "other";

export interface Chapter {
  id: string;
  volume_id: string;
  number: number | null;
  sort_order: number;
  kind: ChapterKind;
  custom_label: string | null;
  title: string;
  title_en: string;
  title_th: string;
  summary: string;
  description: string;
  notes: ChapterNote[];
  read_at: string | null;
  event_count: number;
  tags: Tag[];
  created_at: string;
  updated_at: string;
}

export interface ChapterSummary {
  id: string;
  volume_id: string;
  number: number | null;
  sort_order: number;
  kind: ChapterKind;
  custom_label: string | null;
  title: string;
  title_en: string;
  title_th: string;
  summary?: string;
  notes?: ChapterNote[];
  read_at: string | null;
  character_ids?: string[];
}

export interface ChapterNote {
  id: string;
  content: string;
  content_json?: RichNoteDocument;
  character_ids?: string[];
  mentioned_character_names?: string[];
  references?: ReferenceOccurrence[];
  created_at: string;
  updated_at: string;
}

export interface NovelEvent {
  id: string;
  novel_id: string;
  chapter_id: string | null;
  chapter_volume_id: string | null;
  chapter_title: string | null;
  chapter_number: number | null;
  page_number: number | null;
  title: string;
  description: string;
  story_date: string;
  sort_order: number;
  character_ids: string[];
  character_names: string[];
  description_references?: ReferenceOccurrence[];
  created_at: string;
  updated_at: string;
}

export interface CharacterRole {
  id: string;
  code: string;
  name: string;
  is_active: boolean;
}

export interface CharacterData {
  biographical_and_biological?: {
    name_thai?: string;
    name_japanese?: string;
    romaji?: string;
    blessings?: string[];
    species?: string;
    kind?: string;
    age?: string;
    height?: string;
    length?: string;
    hair_color?: string;
    eye_color?: string;
    status?: string;
  };
  social?: {
    country_of_residence?: string;
    base_of_operations?: string;
    occupations?: string[];
    classes?: string[];
    rank?: string;
    danger_ratings?: string[];
    adventurer_rank?: string;
    affiliations?: string[];
    former_affiliations?: string[];
  };
  debut?: {
    web_novel?: string;
    light_novel?: string;
    manga?: string;
    anime?: string;
  };
}

export type GalleryImageCategory =
  | "official"
  | "anime"
  | "manga"
  | "light-novel"
  | "fan-art"
  | "other";

export interface GalleryImage {
  id: string;
  image_url: string;
  title?: string;
  caption?: string;
  source_url?: string;
  category?: GalleryImageCategory;
  sort_order: number;
}

export interface Character {
  id: string;
  novel_id: string;
  name: string;
  aliases: string[];
  role_id: string;
  role: string;
  role_name: string;
  profile_image_url: string | null;
  description: string;
  appearance: string;
  personality: string;
  trivia: string;
  appearance_content_json?: RichNoteDocument;
  personality_content_json?: RichNoteDocument;
  trivia_content_json?: RichNoteDocument;
  data?: CharacterData;
  gallery?: GalleryImage[];
  first_appearance_chapter_id: string | null;
  chapter_count: number;
  chapters?: ChapterSummary[];
  created_at: string;
  updated_at: string;
}

export interface ChapterWithCharacters extends Chapter {
  character_ids: string[];
  characters: Character[];
  mentioned_character_names: string[];
}

export interface CharacterListSummary {
  total_characters: number;
}

export type CharacterSort = "name" | "updated_at" | "role";
export type SortDirection = "asc" | "desc";

export interface CharacterCursor {
  values: string[];
  id: string;
}

export interface CharacterPage {
  novel: Novel;
  items: Character[];
  pagination: PaginationMeta;
  previousCursor: CharacterCursor | null;
  nextCursor: CharacterCursor | null;
}

export interface PaginatedCharacters {
  items: Character[];
  pagination: PaginationMeta;
  summary: CharacterListSummary;
}
