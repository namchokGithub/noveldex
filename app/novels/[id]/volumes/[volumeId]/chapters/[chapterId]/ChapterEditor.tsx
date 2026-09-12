"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { ChapterKind, ChapterWithCharacters, Tag } from "@/app/types";
import { CHAPTER_KINDS } from "@/libs/chapterLabel";
import { normalizeChapter, normalizeNote } from "@/libs/search/normalize";
import { useSearchIndex } from "@/libs/search/SearchIndexProvider";
import { useChapterKindLabels } from "@/components/chapters/ChapterLabel";
import LinkedCharactersPanel from "./LinkedCharactersPanel";
import {
  cardClassName,
  FormError,
  inputClassName,
  normalizeDateTimeLocalToISOString,
  primaryButtonClassName,
  Snackbar,
  secondaryButtonClassName,
  smallLabelClassName,
  tagClassName,
  textareaClassName,
  toDateTimeLocalInputValue,
} from "@/app/novels/ui";
import { useI18n } from "@/components/i18n/I18nProvider";
import { userErrorMessage } from "@/libs/userErrorMessage";
import { chapterEditorInitialMode } from "@/libs/chapterEditor";
import { CHAPTER_SEARCH_SOURCE_EVENT, type ChapterSearchSource } from "@/components/commands/CommandPalette";
import {
  createTag,
  getChapter,
  getTags,
  linkChapterTag,
  unlinkChapterTag,
  updateChapter,
} from "@/libs/api";

export default function ChapterEditor({
  chapter,
  novelId,
  volumeId,
  initialFind = "",
  showSummary = true,
  notesEditor,
}: {
  chapter: ChapterWithCharacters;
  novelId: string;
  volumeId: string;
  initialFind?: string;
  showSummary?: boolean;
  notesEditor?: ReactNode;
}) {
  const { t } = useI18n();
  const kindLabels = useChapterKindLabels();
  const { entityMap, upsert, upsertMany } = useSearchIndex();
  const router = useRouter();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState(chapter.title ?? "");
  const [savedTitle, setSavedTitle] = useState(chapter.title ?? "");
  const [titleEditing, setTitleEditing] = useState(() => chapterEditorInitialMode().title);
  const [titleError, setTitleError] = useState<string | null>(null);
  const [titleSaving, setTitleSaving] = useState(false);

  const [kind, setKind] = useState<ChapterKind>(chapter.kind);
  const [number, setNumber] = useState(chapter.number === null ? "" : String(chapter.number));
  const [customLabel, setCustomLabel] = useState(chapter.custom_label ?? "");
  const [savedEntry, setSavedEntry] = useState({
    kind: chapter.kind,
    number: chapter.number === null ? "" : String(chapter.number),
    customLabel: chapter.custom_label ?? "",
  });
  const [entryEditing, setEntryEditing] = useState(() => chapterEditorInitialMode().entry);
  const [entryError, setEntryError] = useState<string | null>(null);
  const [entrySaving, setEntrySaving] = useState(false);

  const [summary, setSummary] = useState(chapter.summary ?? "");
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [summarySaving, setSummarySaving] = useState(false);

  const [description, setDescription] = useState(chapter.description ?? "");
  const [savedDescription, setSavedDescription] = useState(chapter.description ?? "");
  const [descriptionEditing, setDescriptionEditing] = useState(false);
  const [descriptionError, setDescriptionError] = useState<string | null>(null);
  const [descriptionSaving, setDescriptionSaving] = useState(false);

  const [readAt, setReadAt] = useState(toDateTimeLocalInputValue(chapter.read_at));
  const [savedReadAt, setSavedReadAt] = useState(toDateTimeLocalInputValue(chapter.read_at));
  const [readAtEditing, setReadAtEditing] = useState(() => chapterEditorInitialMode().readAt);
  const [readAtError, setReadAtError] = useState<string | null>(null);
  const [readAtSaving, setReadAtSaving] = useState(false);

  const [suggestion, setSuggestion] = useState<{
    names: string[];
    anchorText: string;
  } | null>(null);
  const [tags, setTags] = useState<Tag[]>(chapter.tags ?? []);
  const [allTags, setAllTags] = useState<Tag[]>(chapter.tags ?? []);
  const [tagQuery, setTagQuery] = useState("");
  const [tagPickerOpen, setTagPickerOpen] = useState(false);
  const [tagListFetched, setTagListFetched] = useState(false);
  const [tagLoading, setTagLoading] = useState(false);
  const [tagError, setTagError] = useState<string | null>(null);
  const [tagSaving, setTagSaving] = useState(false);
  const [snackbar, setSnackbar] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);

  const focusSearchMatch = useCallback((field: 'title' | 'summary', start: number, length: number) => {
    const input = field === 'title' ? titleRef.current : textareaRef.current;
    if (!input) return;
    input.focus();
    input.setSelectionRange(start, start + length);
    input.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  const resizeSummary = useCallback((el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  useEffect(() => {
    if (!showSummary) return;
    resizeSummary(textareaRef.current);
  }, [resizeSummary, showSummary, summary]);

  useEffect(() => {
    if (!showSummary) return;
    const handler = (event: Event) => {
      const reply = (event as CustomEvent<(source: ChapterSearchSource) => void>).detail;
      if (typeof reply === 'function') reply({ title, summary, focusMatch: focusSearchMatch });
    };
    window.addEventListener(CHAPTER_SEARCH_SOURCE_EVENT, handler);
    return () => window.removeEventListener(CHAPTER_SEARCH_SOURCE_EVENT, handler);
  }, [focusSearchMatch, showSummary, summary, title]);

  useEffect(() => {
    if (!showSummary) return;
    const query = initialFind.trim();
    if (!query) return;
    const titleIndex = title.toLocaleLowerCase().indexOf(query.toLocaleLowerCase());
    const summaryIndex = summary.toLocaleLowerCase().indexOf(query.toLocaleLowerCase());
    const frame = window.requestAnimationFrame(() => {
      if (titleIndex >= 0) focusSearchMatch('title', titleIndex, query.length);
      else if (summaryIndex >= 0) focusSearchMatch('summary', summaryIndex, query.length);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [focusSearchMatch, initialFind, showSummary, summary, title]);

  useEffect(() => {
    if (!snackbar) return;

    const timeoutId = window.setTimeout(() => {
      setSnackbar(null);
    }, 3000);

    return () => window.clearTimeout(timeoutId);
  }, [snackbar]);

  const filteredTagOptions = useMemo(() => {
    const linked = new Set(tags.map((tag) => tag.id));
    return allTags.filter((tag) => {
      if (linked.has(tag.id)) return false;
      if (!tagQuery.trim()) return true;
      return tag.name.toLowerCase().includes(tagQuery.trim().toLowerCase());
    });
  }, [allTags, tagQuery, tags]);

  function handleKeyUp(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Escape") {
      setSuggestion(null);
      return;
    }
    const ta = e.currentTarget;
    const before = ta.value.slice(0, ta.selectionStart ?? ta.value.length);
    const match = before.match(/\[\[([^\]]*)$/);
    if (!match) {
      setSuggestion(null);
      return;
    }
    const typed = match[1];
    const names = chapter.characters
      .map((c) => c.name)
      .filter((n) => n.toLowerCase().startsWith(typed.toLowerCase()));
    setSuggestion({ names, anchorText: match[0] });
  }

  function insertSuggestion(name: string) {
    if (!suggestion) return;
    const ta = textareaRef.current;
    if (!ta) return;
    const pos = ta.selectionStart ?? summary.length;
    const before = summary.slice(0, pos);
    const after = summary.slice(pos);
    const replaced =
      before.slice(0, before.length - suggestion.anchorText.length) +
      `[[${name}]]`;
    setSummary(replaced + after);
    setSuggestion(null);
  }

  async function ensureTagListLoaded() {
    if (tagListFetched || tagLoading) return;
    setTagLoading(true);
    setTagError(null);
    try {
      setAllTags(await getTags(novelId));
      setTagListFetched(true);
    } catch (error) {
      setTagError(userErrorMessage(error, t));
    } finally {
      setTagLoading(false);
    }
  }

  async function createOrFindTag(name: string): Promise<Tag | null> {
    const normalized = name.trim();
    if (!normalized) return null;

    const existing = allTags.find(
      (tag) => tag.name.toLowerCase() === normalized.toLowerCase(),
    );
    if (existing) return existing;

    const created = await createTag(novelId, normalized);
    setAllTags((current) => {
      if (current.some((tag) => tag.id === created.id)) return current;
      return [...current, created].sort((a, b) => a.name.localeCompare(b.name));
    });
    return created;
  }

  async function linkTag(tag: Tag) {
    if (tags.some((entry) => entry.id === tag.id)) return;
    await linkChapterTag(novelId, volumeId, chapter.id, tag.id);
    setTags((current) =>
      [...current, tag].sort((a, b) => a.name.localeCompare(b.name)),
    );
    const updated = await getChapter(novelId, volumeId, chapter.id);
    upsertMany([normalizeChapter(novelId, updated, entityMap, kindLabels), ...updated.notes.map((note) => normalizeNote(novelId, volumeId, chapter.id, note, updated.tags, entityMap))]);
  }

  async function handleAddTag(name?: string) {
    const nextName = (name ?? tagQuery).trim();
    if (!nextName) return;
    setTagSaving(true);
    setTagError(null);
    try {
      const tag = await createOrFindTag(nextName);
      if (!tag) return;
      await linkTag(tag);
      setTagQuery("");
      setTagPickerOpen(false);
    } catch (error) {
      setTagError(userErrorMessage(error, t));
    } finally {
      setTagSaving(false);
    }
  }

  async function handleRemoveTag(tagId: string) {
    setTagSaving(true);
    setTagError(null);
    try {
      await unlinkChapterTag(novelId, volumeId, chapter.id, tagId);
      setTags((current) => current.filter((tag) => tag.id !== tagId));
      const updated = await getChapter(novelId, volumeId, chapter.id);
      upsertMany([normalizeChapter(novelId, updated, entityMap, kindLabels), ...updated.notes.map((note) => normalizeNote(novelId, volumeId, chapter.id, note, updated.tags, entityMap))]);
    } catch (error) {
      setTagError(userErrorMessage(error, t));
    } finally {
      setTagSaving(false);
    }
  }

  async function saveSummary() {
    setSummaryError(null);
    setSummarySaving(true);
    try {
      const updated = await updateChapter(novelId, volumeId, chapter.id, { summary });
      upsert(normalizeChapter(novelId, updated, entityMap, kindLabels));
      setSnackbar({
        tone: "success",
        message: t("chapter.summarySaved"),
      });
      router.refresh();
    } catch (error) {
      const message = userErrorMessage(error, t);
      setSummaryError(message);
      setSnackbar({
        tone: "error",
        message,
      });
    } finally {
      setSummarySaving(false);
    }
  }

  async function saveDescription() {
    setDescriptionError(null);
    setDescriptionSaving(true);
    try {
      const updated = await updateChapter(novelId, volumeId, chapter.id, { description });
      upsert(normalizeChapter(novelId, updated, entityMap, kindLabels));
      setSavedDescription(description);
      setDescriptionEditing(false);
      setSnackbar({
        tone: "success",
        message: t("chapter.descriptionSaved"),
      });
      router.refresh();
    } catch (error) {
      const message = userErrorMessage(error, t);
      setDescriptionError(message);
      setSnackbar({ tone: "error", message });
    } finally {
      setDescriptionSaving(false);
    }
  }

  async function saveTitle() {
    const normalizedTitle = title.trim();
    if (!normalizedTitle) {
      setTitleError(t("chapter.titleRequired"));
      return;
    }

    setTitleError(null);
    setTitleSaving(true);
    try {
      const updated = await updateChapter(novelId, volumeId, chapter.id, {
        title: normalizedTitle,
      });
      upsert(normalizeChapter(novelId, updated, entityMap, kindLabels));
      setTitle(normalizedTitle);
      setSavedTitle(normalizedTitle);
      setTitleEditing(false);
      setSnackbar({
        tone: "success",
        message: t("chapter.titleSaved"),
      });
      router.refresh();
    } catch (error) {
      const message = userErrorMessage(error, t);
      setTitleError(message);
      setSnackbar({
        tone: "error",
        message,
      });
    } finally {
      setTitleSaving(false);
    }
  }

  async function saveEntry() {
    const nextNumber = kind === "chapter" ? Number(number) : 0;
    if (kind === "chapter" && (!Number.isInteger(nextNumber) || nextNumber < 1)) {
      setEntryError(t("chapter.entryNumberRequired"));
      return;
    }
    if (kind === "other" && !customLabel.trim()) {
      setEntryError(t("chapter.entryOtherRequired"));
      return;
    }
    setEntryError(null);
    setEntrySaving(true);
    try {
      const updated = await updateChapter(novelId, volumeId, chapter.id, {
        kind,
        number: nextNumber,
        custom_label: kind === "other" ? customLabel.trim() : null,
      });
      upsert(normalizeChapter(novelId, updated, entityMap, kindLabels));
      setSavedEntry({ kind, number, customLabel });
      setEntryEditing(false);
      setSnackbar({ tone: "success", message: t("chapter.entrySaved") });
      router.refresh();
    } catch (error) {
      const message = userErrorMessage(error, t);
      setEntryError(message);
      setSnackbar({ tone: "error", message });
    } finally {
      setEntrySaving(false);
    }
  }

  async function saveReadAt() {
    setReadAtError(null);
    setReadAtSaving(true);
    try {
      const updated = await updateChapter(novelId, volumeId, chapter.id, {
        read_at: normalizeDateTimeLocalToISOString(readAt),
      });
      upsert(normalizeChapter(novelId, updated, entityMap, kindLabels));
      setSavedReadAt(readAt);
      setReadAtEditing(false);
      setSnackbar({
        tone: "success",
        message: t("chapter.dateSaved"),
      });
      router.refresh();
    } catch (error) {
      const message = userErrorMessage(error, t);
      setReadAtError(message);
      setSnackbar({
        tone: "error",
        message,
      });
    } finally {
      setReadAtSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <div className={cardClassName}>
        <div className="flex items-start justify-between gap-3">
          <label className={smallLabelClassName}>{t("chapter.editTitle")}</label>
          {!titleEditing && <button type="button" onClick={() => setTitleEditing(true)} className={secondaryButtonClassName}>{t("common.edit")}</button>}
        </div>
        {titleEditing ? <>
          <input ref={titleRef} value={title} onChange={(e) => setTitle(e.target.value)} className={inputClassName} placeholder={t("addChapter.chapterTitlePlaceholder")} />
          {titleError && <FormError>{titleError}</FormError>}
          <div className="mt-2 flex justify-end gap-2">
            <button type="button" onClick={() => { setTitle(savedTitle); setTitleError(null); setTitleEditing(false); }} disabled={titleSaving} className={secondaryButtonClassName}>{t("common.cancel")}</button>
            <button type="button" onClick={() => void saveTitle()} disabled={titleSaving} className={primaryButtonClassName}>{titleSaving ? t("common.saving") : t("chapter.saveTitle")}</button>
          </div>
        </> : <p className="break-words text-sm leading-7 text-stone-700">{savedTitle}</p>}
      </div>

      <div className={cardClassName}>
        <div className="flex items-start justify-between gap-3">
          <label className={smallLabelClassName}>{t("common.description")}</label>
          {!descriptionEditing && <button type="button" onClick={() => setDescriptionEditing(true)} className={secondaryButtonClassName}>{t("common.edit")}</button>}
        </div>
        {descriptionEditing ? <>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value.slice(0, 500))}
            maxLength={500}
            rows={3}
            className={textareaClassName}
            placeholder={t("chapter.descriptionPlaceholder")}
          />
          <div className="mt-1 flex justify-end">
            <p className="text-xs text-stone-400">{description.length}/500</p>
          </div>
          {descriptionError && <FormError>{descriptionError}</FormError>}
          <div className="mt-2 flex justify-end gap-2">
            <button type="button" onClick={() => { setDescription(savedDescription); setDescriptionError(null); setDescriptionEditing(false); }} disabled={descriptionSaving} className={secondaryButtonClassName}>{t("common.cancel")}</button>
            <button type="button" onClick={() => void saveDescription()} disabled={descriptionSaving} className={primaryButtonClassName}>{descriptionSaving ? t("common.saving") : t("chapter.saveDescription")}</button>
          </div>
        </> : <p className={`whitespace-pre-wrap break-words text-sm leading-7 ${savedDescription ? "text-stone-700" : "italic text-stone-400"}`}>{savedDescription || t("novels.noDescription")}</p>}
      </div>

      {showSummary && <div className={cardClassName}>
        <label className={smallLabelClassName}>{t("addChapter.summary")}</label>
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            onKeyUp={handleKeyUp}
            rows={6}
            className={`${inputClassName} min-h-45 resize-none overflow-hidden`}
            placeholder={t("addChapter.summaryPlaceholder")}
          />
          {suggestion && suggestion.names.length > 0 && (
            <ul className="absolute left-0 top-full z-10 mt-2 w-full overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-lg">
              {suggestion.names.map((name) => (
                <li key={name}>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      insertSuggestion(name);
                    }}
                    className="w-full px-3 py-2 text-left text-sm text-stone-700 hover:bg-stone-50">
                    {name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {summaryError && (
          <FormError>{summaryError}</FormError>
        )}
        <div className="mt-2 flex justify-end">
          <button
            onClick={saveSummary}
            disabled={summarySaving}
            className={primaryButtonClassName}>
            {summarySaving ? t("common.saving") : t("chapter.saveSummary")}
          </button>
        </div>
      </div>}

      <div className="grid gap-4 md:grid-cols-2">
        <div className={cardClassName}>
          <div className="flex items-start justify-between gap-3">
            <label className={smallLabelClassName}>{t("addChapter.dateRead")}</label>
            {!readAtEditing && <button type="button" onClick={() => setReadAtEditing(true)} className={secondaryButtonClassName}>{t("common.edit")}</button>}
          </div>
          {readAtEditing ? <>
            <input type="datetime-local" step={60} value={readAt} onChange={(e) => setReadAt(e.target.value)} className={inputClassName} />
            {readAtError && <FormError>{readAtError}</FormError>}
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" onClick={() => { setReadAt(savedReadAt); setReadAtError(null); setReadAtEditing(false); }} disabled={readAtSaving} className={secondaryButtonClassName}>{t("common.cancel")}</button>
              <button type="button" onClick={() => void saveReadAt()} disabled={readAtSaving} className={primaryButtonClassName}>{readAtSaving ? t("common.saving") : t("chapter.saveDate")}</button>
            </div>
          </> : <p className="text-sm leading-7 text-stone-700">{savedReadAt ? new Date(savedReadAt).toLocaleString() : "—"}</p>}
        </div>

        <div className={cardClassName}>
          <div className="flex items-start justify-between gap-3">
            <label className={smallLabelClassName}>{t("chapter.editEntry")}</label>
            {!entryEditing && <button type="button" onClick={() => setEntryEditing(true)} className={secondaryButtonClassName}>{t("common.edit")}</button>}
          </div>
          {entryEditing ? <>
            <select value={kind} onChange={(event) => setKind(event.target.value as ChapterKind)} className={inputClassName}>
              {CHAPTER_KINDS.map((entryKind) => <option key={entryKind} value={entryKind}>{kindLabels[entryKind]}</option>)}
            </select>
            {kind === "chapter" && <div className="mt-3"><label className={smallLabelClassName}>{t("addChapter.numberRequired")}</label><input type="number" min={1} value={number} onChange={(event) => setNumber(event.target.value)} className={inputClassName} /></div>}
            {kind === "other" && <div className="mt-3"><label className={smallLabelClassName}>{t("addChapter.customLabel")}</label><input value={customLabel} onChange={(event) => setCustomLabel(event.target.value)} maxLength={80} className={inputClassName} placeholder={t("addChapter.customLabelPlaceholder")} /></div>}
            {entryError && <FormError>{entryError}</FormError>}
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" onClick={() => { setKind(savedEntry.kind); setNumber(savedEntry.number); setCustomLabel(savedEntry.customLabel); setEntryError(null); setEntryEditing(false); }} disabled={entrySaving} className={secondaryButtonClassName}>{t("common.cancel")}</button>
              <button type="button" onClick={() => void saveEntry()} disabled={entrySaving} className={primaryButtonClassName}>{entrySaving ? t("common.saving") : t("chapter.saveEntry")}</button>
            </div>
          </> : <p className="break-words text-sm leading-7 text-stone-700">{savedEntry.kind === "chapter" ? `${kindLabels.chapter} ${savedEntry.number}` : savedEntry.kind === "other" ? savedEntry.customLabel : kindLabels[savedEntry.kind]}</p>}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className={cardClassName}>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.24em] text-stone-500">
            {t("chapter.tags")}
          </h2>
          <div className="flex flex-wrap items-center gap-2">
          {tags.map((tag) => (
            <span key={tag.id} className={tagClassName}>
              {tag.name}
              <button
                type="button"
                onClick={() => handleRemoveTag(tag.id)}
                disabled={tagSaving}
                className="text-amber-700 hover:text-amber-900 disabled:opacity-50"
                aria-label={t("chapter.removeTag", { name: tag.name })}>
                ×
              </button>
            </span>
          ))}

          {!tagPickerOpen ? (
            <button
              type="button"
              onClick={async () => {
                setTagPickerOpen(true);
                await ensureTagListLoaded();
              }}
              className="rounded-full border border-dashed border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-600 hover:border-stone-400 hover:text-stone-900">
              {t("chapter.addTag")}
            </button>
          ) : (
            <div className="w-full max-w-sm rounded-[22px] border border-stone-200 bg-stone-50/90 p-3 shadow-sm">
              <input
                value={tagQuery}
                onChange={(e) => setTagQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void handleAddTag();
                  }
                  if (e.key === "Escape") {
                    setTagPickerOpen(false);
                    setTagQuery("");
                  }
                }}
                placeholder={t("chapter.addTagPlaceholder")}
                className={inputClassName}
              />
              <div className="mt-2 max-h-40 overflow-y-auto">
                {tagLoading && (
                  <p className="text-xs text-stone-500">
                    {t("chapter.loadingTags")}
                  </p>
                )}
                {!tagLoading && filteredTagOptions.length > 0 && (
                  <ul className="space-y-1">
                    {filteredTagOptions.map((tag) => (
                      <li key={tag.id}>
                        <button
                          type="button"
                          onClick={() => void handleAddTag(tag.name)}
                          className="w-full rounded-xl px-2 py-1.5 text-left text-sm text-stone-700 hover:bg-white">
                          {tag.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {!tagLoading && filteredTagOptions.length === 0 && (
                  <p className="text-xs text-stone-500">
                    {tagQuery.trim()
                      ? t("chapter.createTagHint")
                      : t("chapter.noMoreTags")}
                  </p>
                )}
              </div>
              <div className="mt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setTagPickerOpen(false);
                    setTagQuery("");
                  }}
                  className={secondaryButtonClassName}>
                  {t("common.cancel")}
                </button>
                <button
                  type="button"
                  onClick={() => void handleAddTag()}
                  disabled={tagSaving || !tagQuery.trim()}
                  className={primaryButtonClassName}>
                  {t("common.add")}
                </button>
              </div>
            </div>
          )}
          </div>
          {tagError && <FormError>{tagError}</FormError>}
        </div>

        <div className={cardClassName}>
          <LinkedCharactersPanel
            characters={chapter.characters}
            mentionedCharacterNames={chapter.mentioned_character_names}
            novelId={novelId}
          />
        </div>
      </div>

      {notesEditor}

      <Snackbar
        open={Boolean(snackbar)}
        tone={snackbar?.tone}
        message={snackbar?.message}
        onClose={() => setSnackbar(null)}
        closeLabel={t("common.ok")}
      />
    </div>
  );
}
