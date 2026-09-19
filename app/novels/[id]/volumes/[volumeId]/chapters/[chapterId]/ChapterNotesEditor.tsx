"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ChapterNote, Character, Tag } from "@/app/types";
import type { Entity } from "@/libs/entities/types";
import {
  genericEntityHref,
  resolveCharacterReference,
  resolveGenericReference,
} from "@/libs/richNotes/preview";
import { entityReferenceClassName } from "@/libs/richNotes/tagColors";
import {
  CHAPTER_SEARCH_SOURCE_EVENT,
  type ChapterSearchSource,
} from "@/components/commands/CommandPalette";
import { useI18n } from "@/components/i18n/I18nProvider";
import {
  cardClassName,
  inputClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
  smallLabelClassName,
} from "@/app/novels/ui";
import { updateChapter } from "@/libs/api";
import { useAuth } from "@/components/auth/AuthProvider";
import { useResetOnSignOut } from "@/components/auth/useResetOnSignOut";
import { userErrorMessage } from "@/libs/userErrorMessage";
import { useSearchIndex } from "@/libs/search/SearchIndexProvider";
import { nextListIndex } from "@/libs/keyboardList";
import { shouldCancelInlineEdit } from "@/libs/inlineEditKeyboard";
import { normalizeChapter, normalizeNote } from "@/libs/search/normalize";
import { diffNotes } from "@/libs/search/diffNotes";
import { useChapterKindLabels } from "@/components/chapters/ChapterLabel";
import {
  RichNoteContent,
  RichNoteEditor,
} from "@/components/notes/RichNoteEditor";
import type { RichNoteDocument } from "@/libs/richNotes/document";
import ConfirmDialog from "@/app/novels/ConfirmDialog";
import ChapterReferenceGuide from "@/components/notes/ChapterReferenceGuide";

function nextId() {
  return crypto.randomUUID();
}
const NOTES_PER_PAGE = 5;

export default function ChapterNotesEditor({
  notes: initialNotes,
  characters,
  entities,
  tags,
  novelId,
  volumeId,
  chapterId,
  initialFind = "",
  initialNoteId = "",
}: {
  notes: ChapterNote[];
  characters: Character[];
  entities: Entity[];
  tags: Tag[];
  novelId: string;
  volumeId: string;
  chapterId: string;
  initialFind?: string;
  initialNoteId?: string;
}) {
  const { t, language } = useI18n();
  const router = useRouter();
  const labels = useChapterKindLabels();
  const { entityMap, upsertMany, discardMany } = useSearchIndex();
  const { isAdmin } = useAuth();
  const [notes, setNotes] = useState<ChapterNote[]>(initialNotes),
    [page, setPage] = useState(1),
    [editingId, setEditingId] = useState<string | null>(null),
    [draft, setDraft] = useState(""),
    [draftJson, setDraftJson] = useState<RichNoteDocument | undefined>(),
    [deleting, setDeleting] = useState<ChapterNote | null>(null),
    [saving, setSaving] = useState(false),
    [error, setError] = useState<string | null>(null),
    [highlight, setHighlight] = useState<{
      noteId: string;
      query: string;
    } | null>(null);
  useResetOnSignOut(isAdmin, () => {
    setEditingId(null);
    setDeleting(null);
  });
  const totalPages = Math.max(1, Math.ceil(notes.length / NOTES_PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const firstNoteIndex = (currentPage - 1) * NOTES_PER_PAGE;
  const visibleNotes = notes.slice(
    firstNoteIndex,
    firstNoteIndex + NOTES_PER_PAGE,
  );
  const focusMatch = useCallback(
    (field: "title" | "summary", start: number, length: number) => {
      if (field === "title") return;
      let offset = start;
      for (const [index, note] of notes.entries()) {
        if (offset <= note.content.length) {
          setPage(Math.floor(index / NOTES_PER_PAGE) + 1);
          setHighlight({
            noteId: note.id,
            query: note.content.slice(offset, offset + length),
          });
          window.requestAnimationFrame(() => {
            document
              .getElementById(`note-${note.id}`)
              ?.scrollIntoView({ behavior: "smooth", block: "center" });
          });
          return;
        }
        offset -= note.content.length + 1;
      }
    },
    [notes],
  );
  const source = useCallback(
    (): ChapterSearchSource => ({
      title: "",
      summary: notes.map((note) => note.content).join("\n"),
      focusMatch,
    }),
    [focusMatch, notes],
  );
  useEffect(() => {
    const handler = (event: Event) => {
      const reply = (event as CustomEvent<(next: ChapterSearchSource) => void>)
        .detail;
      if (typeof reply === "function") reply(source());
    };
    window.addEventListener(CHAPTER_SEARCH_SOURCE_EVENT, handler);
    return () =>
      window.removeEventListener(CHAPTER_SEARCH_SOURCE_EVENT, handler);
  }, [source]);
  useEffect(() => {
    const query = initialFind.trim();
    if (!query) return;
    const joined = notes
      .map((note) => note.content)
      .join("\n")
      .toLocaleLowerCase();
    const start = joined.indexOf(query.toLocaleLowerCase());
    if (start < 0) return;
    const frame = window.requestAnimationFrame(() =>
      focusMatch("summary", start, query.length),
    );
    return () => window.cancelAnimationFrame(frame);
  }, [focusMatch, initialFind, notes]);
  useEffect(() => {
    if (!initialNoteId) return;
    const index = notes.findIndex((note) => note.id === initialNoteId);
    if (index < 0) return;
    const frame = window.requestAnimationFrame(() =>
      setPage(Math.floor(index / NOTES_PER_PAGE) + 1),
    );
    return () => window.cancelAnimationFrame(frame);
  }, [initialNoteId, notes]);
  useEffect(() => {
    if (
      !initialNoteId ||
      !visibleNotes.some((note) => note.id === initialNoteId)
    )
      return;
    const frame = window.requestAnimationFrame(() =>
      document
        .getElementById(`note-${initialNoteId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" }),
    );
    return () => window.cancelAnimationFrame(frame);
  }, [initialNoteId, visibleNotes]);
  function begin(note?: ChapterNote) {
    setEditingId(note?.id ?? "__new__");
    setDraft(note?.content ?? "");
    setDraftJson(note?.content_json);
    setError(null);
  }
  async function save() {
    if (!editingId) return;
    const content = draft.trim();
    if (!content) {
      setError(t("chapter.noteRequired"));
      return;
    }
    const now = new Date().toISOString();
    const note =
      editingId === "__new__"
        ? {
            id: nextId(),
            content,
            ...(draftJson ? { content_json: draftJson } : {}),
            created_at: now,
            updated_at: now,
          }
        : notes.find((item) => item.id === editingId);
    if (!note) return;
    const next =
      editingId === "__new__"
        ? [...notes, note]
        : notes.map((item) =>
            item.id === note.id
              ? {
                  ...item,
                  content,
                  ...(draftJson ? { content_json: draftJson } : {}),
                  updated_at: now,
                }
              : item,
          );
    setSaving(true);
    setError(null);
    try {
      const updated = await updateChapter(novelId, volumeId, chapterId, {
        notes: next,
      });
      const delta = diffNotes(notes, updated.notes);
      discardMany(
        delta.removedIds.map(
          (id) => `note:${novelId}:${volumeId}:${chapterId}:${id}`,
        ),
      );
      upsertMany([
        ...delta.changed.map((changed) =>
          normalizeNote(novelId, volumeId, chapterId, changed, tags, entityMap),
        ),
        normalizeChapter(novelId, updated, entityMap, labels),
      ]);
      setNotes(updated.notes);
      if (editingId === "__new__")
        setPage(Math.ceil(updated.notes.length / NOTES_PER_PAGE));
      setEditingId(null);
      setDraft("");
      setDraftJson(undefined);
      router.refresh();
    } catch (cause) {
      setError(userErrorMessage(cause, t));
    } finally {
      setSaving(false);
    }
  }
  async function remove() {
    if (!deleting) return;
    const next = notes.filter((item) => item.id !== deleting.id);
    setSaving(true);
    try {
      const updated = await updateChapter(novelId, volumeId, chapterId, {
        notes: next,
      });
      const delta = diffNotes(notes, updated.notes);
      discardMany(
        delta.removedIds.map(
          (id) => `note:${novelId}:${volumeId}:${chapterId}:${id}`,
        ),
      );
      upsertMany([
        ...delta.changed.map((changed) =>
          normalizeNote(novelId, volumeId, chapterId, changed, tags, entityMap),
        ),
        normalizeChapter(novelId, updated, entityMap, labels),
      ]);
      setNotes(updated.notes);
      setDeleting(null);
      setPage((current) =>
        Math.min(
          current,
          Math.max(1, Math.ceil(updated.notes.length / NOTES_PER_PAGE)),
        ),
      );
      router.refresh();
    } catch (cause) {
      setError(userErrorMessage(cause, t));
    } finally {
      setSaving(false);
    }
  }
  return (
    <section className={cardClassName}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-[0.24em] text-stone-500">
          {t("chapter.notes")}
        </h2>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <ChapterReferenceGuide />
          {editingId === null && isAdmin && (
            <button
              type="button"
              onClick={() => begin()}
              className={secondaryButtonClassName}>
              {t("chapter.addNote")}
            </button>
          )}
        </div>
      </div>
      <div className="space-y-3">
        {visibleNotes.map((note, index) => (
          <article
            id={`note-${note.id}`}
            key={note.id}
            className="rounded-2xl border border-stone-200 bg-stone-50/60 p-4">
            <div className="mb-2 flex items-center justify-between gap-2 text-xs text-stone-500">
              <span>
                {t("chapter.noteNumber", {
                  number: firstNoteIndex + index + 1,
                })}
              </span>
              <time dateTime={note.updated_at}>
                {new Date(note.updated_at).toLocaleString(language)}
              </time>
            </div>
            {editingId === note.id ? (
              <NoteForm
                value={draft}
                contentJson={draftJson}
                onChange={(next) => {
                  setDraft(next.content);
                  setDraftJson(next.contentJson);
                }}
                entities={entities}
                onSave={() => void save()}
                onCancel={() => setEditingId(null)}
                saving={saving}
              />
            ) : (
              <>
                <CollapsibleNoteContent
                  content={note.content}
                  contentJson={note.content_json}
                  highlight={
                    highlight?.noteId === note.id ? highlight.query : ""
                  }
                  characters={characters}
                  entities={entities}
                  novelId={novelId}
                  readMoreLabel={t("common.readFull")}
                  showLessLabel={t("common.showLess")}
                />
                {isAdmin && (
                  <div className="mt-3 flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => begin(note)}
                      className={secondaryButtonClassName}>
                      {t("common.edit")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleting(note)}
                      disabled={saving}
                      className={secondaryButtonClassName}>
                      {t("common.delete")}
                    </button>
                  </div>
                )}
              </>
            )}
          </article>
        ))}
        {editingId === "__new__" && (
          <article className="rounded-2xl border border-dashed border-stone-300 p-4">
            <NoteForm
              value={draft}
              contentJson={draftJson}
              onChange={(next) => {
                setDraft(next.content);
                setDraftJson(next.contentJson);
              }}
              entities={entities}
              onSave={() => void save()}
              onCancel={() => setEditingId(null)}
              saving={saving}
            />
          </article>
        )}
        {notes.length === 0 && editingId === null && (
          <p className="py-5 text-center text-sm text-stone-500">
            {t("chapter.noNotes")}
          </p>
        )}
      </div>
      {notes.length > NOTES_PER_PAGE && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-stone-200 pt-4">
          <p className="text-sm text-stone-500">
            {t("common.pageOf", { page: currentPage, total: totalPages })}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={currentPage === 1}
              className={secondaryButtonClassName}>
              {t("common.previous")}
            </button>
            <button
              type="button"
              onClick={() =>
                setPage((current) => Math.min(totalPages, current + 1))
              }
              disabled={currentPage === totalPages}
              className={secondaryButtonClassName}>
              {t("common.next")}
            </button>
          </div>
        </div>
      )}
      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
      <ConfirmDialog
        open={isAdmin && Boolean(deleting)}
        eyebrow={t("chapter.notes")}
        title={t("chapter.deleteNoteTitle")}
        description={t("chapter.deleteNoteBody")}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        onConfirm={() => void remove()}
        onCancel={() => setDeleting(null)}
        busy={saving}
        danger
      />
    </section>
  );
}

function CollapsibleNoteContent({
  content,
  contentJson,
  highlight,
  characters,
  entities,
  novelId,
  readMoreLabel,
  showLessLabel,
}: {
  content: string;
  contentJson?: RichNoteDocument;
  highlight: string;
  characters: Character[];
  entities: Entity[];
  novelId: string;
  readMoreLabel: string;
  showLessLabel: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const isLong = content.length > 600;
  const elements = contentJson ? (
    <RichNoteContent
      content={content}
      contentJson={contentJson}
      characters={characters}
      entities={entities}
      novelId={novelId}
    />
  ) : (
    content.split(/\[\[([^\]]+)\]\]/).map((part, index) => {
      if (index % 2 === 0)
        return <span key={index}>{highlightText(part, highlight)}</span>;
      const [prefix, ...rest] = part.split(":");
      const entityTypes = [
        "character",
        "location",
        "skill",
        "organization",
        "item",
        "concept",
      ] as const;
      const entityType = entityTypes.includes(prefix as (typeof entityTypes)[number])
        ? prefix as (typeof entityTypes)[number]
        : "character";
      const label = entityType === "character" ? part : rest.join(":");
      const character = entityType === "character"
        ? resolveCharacterReference(characters, label)
        : undefined;
      const generic = entityType === "character"
        ? null
        : resolveGenericReference(entities, entityType, label);
      const href = character
        ? `/novels/${novelId}/characters/${character.id}`
        : generic
          ? genericEntityHref(novelId, generic)
          : null;
      return href ? (
        <Link
          key={index}
          href={href}
          className={entityReferenceClassName(entityType)}>
          {label}
        </Link>
      ) : (
        <span key={index} className="text-stone-400">
          {label}
        </span>
      );
    })
  );

  return (
    <>
      {contentJson ? (
        <div className={isLong && !expanded ? "max-h-64 overflow-hidden" : ""}>
          {elements}
        </div>
      ) : (
        <p
          className={`whitespace-pre-wrap text-sm leading-7 text-stone-700 ${isLong && !expanded ? "max-h-64 overflow-hidden" : ""}`}>
          {elements}
        </p>
      )}
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          className="mt-3 text-sm font-medium text-stone-700 underline decoration-stone-300 underline-offset-4 transition hover:text-stone-950 hover:decoration-stone-500">
          {expanded ? showLessLabel : readMoreLabel}
        </button>
      )}
    </>
  );
}

function highlightText(value: string, query: string) {
  if (!query) return value;
  const position = value.toLocaleLowerCase().indexOf(query.toLocaleLowerCase());
  if (position < 0) return value;
  return (
    <>
      {value.slice(0, position)}
      <mark className="rounded bg-sky-200 px-0.5 text-inherit">
        {value.slice(position, position + query.length)}
      </mark>
      {value.slice(position + query.length)}
    </>
  );
}

function NoteForm({
  value,
  contentJson,
  onChange,
  entities,
  inputRef,
  suggestionsFor,
  onSave,
  onCancel,
  saving,
}: {
  value: string;
  contentJson?: RichNoteDocument;
  onChange: (value: { content: string; contentJson: RichNoteDocument }) => void;
  entities: import("@/libs/entities/types").Entity[];
  inputRef?: (node: HTMLTextAreaElement | null) => void;
  suggestionsFor?: (value: string, cursor: number) => string[];
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const { t } = useI18n();
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);

  return (
    <div>
      <label className={smallLabelClassName}>{t("chapter.noteContent")}</label>
      <RichNoteEditor
        initialContent={value}
        initialContentJson={contentJson}
        entities={entities}
        onChange={onChange}
      />
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={onCancel}
          className={secondaryButtonClassName}>
          {t("common.cancel")}
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className={primaryButtonClassName}>
          {saving ? t("common.saving") : t("common.save")}
        </button>
      </div>
    </div>
  );

  function resize(node: HTMLTextAreaElement | null) {
    if (!node) return;
    node.style.height = "auto";
    node.style.height = `${node.scrollHeight}px`;
  }
  function refreshSuggestions(nextValue: string, cursor: number) {
    setSuggestions(suggestionsFor?.(nextValue, cursor) ?? []);
    setActiveSuggestionIndex(-1);
  }
  function update(event: React.ChangeEvent<HTMLTextAreaElement>) {
    onChange({
      content: event.target.value,
      contentJson: contentJson ?? { type: "doc", content: [] },
    });
    refreshSuggestions(
      event.target.value,
      event.target.selectionStart ?? event.target.value.length,
    );
    resize(event.target);
  }
  function selectSuggestion(name: string) {
    void name;
    onChange({
      content: value,
      contentJson: contentJson ?? { type: "doc", content: [] },
    });
    setSuggestions([]);
    setActiveSuggestionIndex(-1);
  }
  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (!suggestions.length) return;
      event.preventDefault();
      setActiveSuggestionIndex((current) =>
        nextListIndex(current, suggestions.length, event.key),
      );
      return;
    }
    if (event.key === "Enter" && activeSuggestionIndex >= 0) {
      event.preventDefault();
      selectSuggestion(suggestions[activeSuggestionIndex]);
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      if (suggestions.length) {
        setSuggestions([]);
        setActiveSuggestionIndex(-1);
        return;
      }
      if (shouldCancelInlineEdit(event.key, saving)) onCancel();
    }
  }
}
