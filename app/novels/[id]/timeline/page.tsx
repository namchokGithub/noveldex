"use client";

import { use, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { ChapterKind, CharacterRole, NovelEvent } from "@/app/types";
import type { VolumeSearchSource } from "@/libs/firebase/volumes";
import { formatChapterLabel } from "@/libs/chapterLabel";
import { localizedVolumeTitle } from "@/libs/volumeTitle";
import { localizedChapterTitle } from "@/libs/chapterTitle";
import { eventOrder, nextEventPosition } from "@/libs/timelineOrder";
import {
  paginateStoryPages,
  paginateStorySequences,
} from "@/libs/timelinePagination";
import { useChapterKindLabels } from "@/components/chapters/ChapterLabel";
import {
  backLinkClassName,
  cardClassName,
  DashboardPage,
  inputClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
  SectionHeading,
  Snackbar,
  smallLabelClassName,
  timelineDotClassName,
  timelineRailClassName,
} from "../../ui";
import ConfirmDialog from "../../ConfirmDialog";
import { useI18n } from "@/components/i18n/I18nProvider";
import { useAuth } from "@/components/auth/AuthProvider";
import { Select } from "@/components/ui/Select";
import {
  createCharacter,
  createEvent,
  deleteEvent,
  getAllCharacters,
  getCharacterRoles,
  getChaptersFlat,
  getEvents,
  getVolumesFlat,
  updateEvent,
} from "@/libs/api";
import { userErrorMessage } from "@/libs/userErrorMessage";
import { useSearchIndex } from "@/libs/search/SearchIndexProvider";
import { normalizeEvent } from "@/libs/search/normalize";
import { TimelineEventActions } from "./TimelineEventActions";

interface ChapterOption {
  id: string;
  volume_id: string;
  number: number | null;
  sort_order: number;
  kind: ChapterKind;
  custom_label: string | null;
  title: string;
}
interface CharacterOption {
  id: string;
  name: string;
}
interface FormState {
  title: string;
  sort_order: string;
  page_number: string;
  description: string;
  chapter_id: string;
  chapter_volume_id: string;
  character_ids: string[];
}
interface TimelineGroup {
  key: string;
  volume: VolumeSearchSource | null;
  chapter: ChapterOption | null;
  events: NovelEvent[];
}
const EMPTY_FORM: FormState = {
  title: "",
  sort_order: "0",
  page_number: "",
  description: "",
  chapter_id: "",
  chapter_volume_id: "",
  character_ids: [],
};
export default function TimelinePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { t, language } = useI18n();
  const { isAdmin } = useAuth();
  const { id: novelId } = use(params);
  const kindLabels = useChapterKindLabels();
  const { entityMap, upsert, discard } = useSearchIndex();
  const [events, setEvents] = useState<NovelEvent[]>([]),
    [chapters, setChapters] = useState<ChapterOption[]>([]),
    [volumes, setVolumes] = useState<VolumeSearchSource[]>([]),
    [characters, setCharacters] = useState<CharacterOption[]>([]),
    [roles, setRoles] = useState<CharacterRole[]>([]),
    [loading, setLoading] = useState(true);
  const [filterChars, setFilterChars] = useState<string[]>([]),
    [filterOpen, setFilterOpen] = useState(false);
  const [selectedVolumeId, setSelectedVolumeId] = useState("");
  const filterRef = useRef<HTMLDivElement>(null);
  const [showAddForm, setShowAddForm] = useState(false),
    [addForm, setAddForm] = useState<FormState>(EMPTY_FORM),
    [addError, setAddError] = useState<string | null>(null),
    [addSaving, setAddSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null),
    [editForm, setEditForm] = useState<FormState>(EMPTY_FORM),
    [editError, setEditError] = useState<string | null>(null),
    [editSaving, setEditSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null),
    [confirmDeleteEvent, setConfirmDeleteEvent] = useState<NovelEvent | null>(
      null,
    ),
    [snackbar, setSnackbar] = useState<{
      tone: "success" | "error";
      message: string;
    } | null>(null);
  const [wasAdmin, setWasAdmin] = useState(isAdmin);
  if (wasAdmin !== isAdmin) {
    setWasAdmin(isAdmin);
    if (!isAdmin) {
      setShowAddForm(false);
      setEditingId(null);
      setConfirmDeleteEvent(null);
    }
  }
  async function loadEvents() {
    setEvents(
      await getEvents(
        novelId,
        new Map(characters.map((character) => [character.id, character.name])),
      ),
    );
  }
  useEffect(() => {
    async function init() {
      setLoading(true);
      try {
        const charactersPromise = getAllCharacters(novelId);
        const [ev, ch, char, volumeItems, role] = await Promise.all([
          getEvents(
            novelId,
            charactersPromise.then(
              (characters) =>
                new Map(characters.map(({ id, name }) => [id, name])),
            ),
          ),
          getChaptersFlat(novelId),
          charactersPromise,
          getVolumesFlat(novelId),
          getCharacterRoles(),
        ]);
        setEvents(ev);
        setChapters(ch);
        setCharacters(char.map(({ id, name }) => ({ id, name })));
        setVolumes(volumeItems);
        setSelectedVolumeId((current) =>
          volumeItems.some((volume) => volume.id === current)
            ? current
            : (volumeItems[0]?.id ?? ""),
        );
        setRoles(role);
      } catch {
        setSnackbar({ tone: "error", message: t("common.networkError") });
      } finally {
        setLoading(false);
      }
    }
    void init();
  }, [novelId, t]);
  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (
        filterRef.current &&
        !filterRef.current.contains(event.target as Node)
      )
        setFilterOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  useEffect(() => {
    if (!snackbar) return;
    const id = window.setTimeout(() => setSnackbar(null), 3000);
    return () => window.clearTimeout(id);
  }, [snackbar]);
  const displayed = filterChars.length
    ? events.filter((event) =>
        filterChars.some((id) => event.character_ids.includes(id)),
      )
    : events;
  const groups = useMemo<TimelineGroup[]>(() => {
    const result = new Map<string, TimelineGroup>();
    for (const event of [...displayed].sort((a, b) =>
      eventOrder(a, b, chapters, volumes),
    )) {
      const chapter = chapters.find((x) => x.id === event.chapter_id) ?? null;
      const volume =
        volumes.find(
          (x) => x.id === (event.chapter_volume_id ?? chapter?.volume_id),
        ) ?? null;
      const key = chapter && volume ? `${volume.id}:${chapter.id}` : "unplaced";
      const group = result.get(key);
      if (group) group.events.push(event);
      else result.set(key, { key, volume, chapter, events: [event] });
    }
    return [...result.values()];
  }, [chapters, displayed, volumes]);
  const visibleGroups = selectedVolumeId
    ? groups.filter((group) => group.volume?.id === selectedVolumeId)
    : groups;
  const toPayload = (form: FormState) => ({
    title: form.title.trim(),
    description: form.description.trim(),
    sort_order: Number.parseInt(form.sort_order, 10) || 0,
    page_number:
      form.page_number === "" ? null : Number.parseInt(form.page_number, 10),
    chapter_id: form.chapter_id || null,
    chapter_volume_id: form.chapter_volume_id || null,
    character_ids: form.character_ids,
  });
  async function handleAdd(event: React.FormEvent) {
    event.preventDefault();
    setAddError(null);
    setAddSaving(true);
    try {
      const created = await createEvent(novelId, toPayload(addForm));
      upsert(normalizeEvent(created, null, entityMap, kindLabels));
      setAddForm(EMPTY_FORM);
      setShowAddForm(false);
      await loadEvents();
      setSnackbar({ tone: "success", message: t("timeline.addSuccess") });
    } catch (error) {
      const message = userErrorMessage(error, t);
      setAddError(message);
      setSnackbar({ tone: "error", message });
    } finally {
      setAddSaving(false);
    }
  }
  function openAddForm() {
    setAddForm(EMPTY_FORM);
    setAddError(null);
    setShowAddForm(true);
  }
  function startEdit(event: NovelEvent) {
    setEditingId(event.id);
    setEditForm({
      title: event.title,
      sort_order: String(event.sort_order),
      page_number: event.page_number === null ? "" : String(event.page_number),
      description: event.description,
      chapter_id: event.chapter_id ?? "",
      chapter_volume_id:
        event.chapter_volume_id ??
        chapters.find((x) => x.id === event.chapter_id)?.volume_id ??
        "",
      character_ids: event.character_ids,
    });
    setEditError(null);
  }
  async function handleEdit(event: React.FormEvent) {
    event.preventDefault();
    if (!editingId) return;
    setEditError(null);
    setEditSaving(true);
    try {
      const updated = await updateEvent(
        novelId,
        editingId,
        toPayload(editForm),
      );
      upsert(normalizeEvent(updated, null, entityMap, kindLabels));
      setEditingId(null);
      await loadEvents();
      setSnackbar({ tone: "success", message: t("timeline.editSuccess") });
    } catch (error) {
      const message = userErrorMessage(error, t);
      setEditError(message);
      setSnackbar({ tone: "error", message });
    } finally {
      setEditSaving(false);
    }
  }
  async function addCharacter(name: string, roleId: string) {
    const normalized = name.trim();
    const existing = characters.find(
      (x) =>
        x.name.trim().toLocaleLowerCase() === normalized.toLocaleLowerCase(),
    );
    if (existing) return existing;
    const created = await createCharacter(novelId, {
      name: normalized,
      ...(roleId ? { role_id: roleId } : {}),
      description: "",
      aliases: [],
    });
    const option = { id: created.id, name: created.name };
    setCharacters((all) =>
      [...all, option].sort((a, b) => a.name.localeCompare(b.name)),
    );
    return option;
  }
  async function handleDelete() {
    if (!confirmDeleteEvent) return;
    setDeletingId(confirmDeleteEvent.id);
    try {
      await deleteEvent(novelId, confirmDeleteEvent.id);
      discard(`event:${novelId}:${confirmDeleteEvent.id}`);
      setConfirmDeleteEvent(null);
      await loadEvents();
      setSnackbar({ tone: "success", message: t("timeline.deleteSuccess") });
    } catch (error) {
      setSnackbar({ tone: "error", message: userErrorMessage(error, t) });
    } finally {
      setDeletingId(null);
    }
  }
  return (
    <DashboardPage maxWidth="w-full max-w-6xl">
      <div className="space-y-5">
        <Link href={`/novels/${novelId}`} className={backLinkClassName}>
          ← {t("nav.backToNovel")}
        </Link>
        <SectionHeading
          eyebrow={t("timeline.eyebrow")}
          title={t("timeline.title")}
          description={t("timeline.description")}
          action={
            isAdmin ? (
              <button
                onClick={() => {
                  if (showAddForm) {
                    setShowAddForm(false);
                    setAddForm(EMPTY_FORM);
                  } else {
                    openAddForm();
                  }
                }}
                className={
                  showAddForm
                    ? secondaryButtonClassName
                    : primaryButtonClassName
                }>
                {showAddForm
                  ? t("common.cancel")
                  : t("timeline.addEventToggle")}
              </button>
            ) : undefined
          }
        />
        {showAddForm && isAdmin && (
          <form onSubmit={handleAdd} className={cardClassName}>
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.24em] text-stone-500">
              {t("timeline.newEvent")}
            </h2>
            <EventFormFields
              form={addForm}
              onChange={setAddForm}
              events={events}
              chapters={chapters}
              volumes={volumes}
              characters={characters}
              roles={roles}
              autoPosition
              requireChapter
              onAddCharacter={addCharacter}
            />
            {addError && (
              <p className="mt-2 text-sm text-rose-600">{addError}</p>
            )}
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                disabled={addSaving}
                onClick={() => {
                  setShowAddForm(false);
                  setAddForm(EMPTY_FORM);
                }}
                className={secondaryButtonClassName}>
                {t("common.cancel")}
              </button>
              <button
                type="submit"
                disabled={addSaving}
                className={primaryButtonClassName}>
                {addSaving ? t("common.saving") : t("timeline.addEvent")}
              </button>
            </div>
          </form>
        )}
        {characters.length > 0 && (
          <div ref={filterRef} className="relative">
            <button
              onClick={() => setFilterOpen((x) => !x)}
              className={secondaryButtonClassName}>
              {t("timeline.filterByCharacter")}
              {filterChars.length > 0 && (
                <span className="rounded-full bg-stone-900 px-2 py-0.5 text-xs text-stone-50">
                  {filterChars.length}
                </span>
              )}
              <span className="text-xs text-stone-400">
                {filterOpen ? "▲" : "▼"}
              </span>
            </button>
            {filterOpen && (
              <div className="absolute left-0 top-full z-10 mt-2 w-[min(18rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-stone-200 bg-white py-1 shadow-lg">
                {characters.map((character) => (
                  <label
                    key={character.id}
                    className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm text-stone-700 hover:bg-stone-50">
                    <input
                      type="checkbox"
                      checked={filterChars.includes(character.id)}
                      onChange={() =>
                        setFilterChars((all) =>
                          all.includes(character.id)
                            ? all.filter((id) => id !== character.id)
                            : [...all, character.id],
                        )
                      }
                      className="accent-stone-900"
                    />
                    {character.name}
                  </label>
                ))}
                {filterChars.length > 0 && (
                  <button
                    onClick={() => setFilterChars([])}
                    className="w-full border-t border-stone-200 px-3 py-2 text-left text-xs text-stone-500 hover:text-stone-900">
                    {t("timeline.clearFilter")}
                  </button>
                )}
              </div>
            )}
          </div>
        )}
        {volumes.length > 0 && (
          <div className="max-w-sm">
            <label className={smallLabelClassName}>
              {t("timeline.volume")}
            </label>
            <Select
              value={selectedVolumeId}
              onValueChange={setSelectedVolumeId}
              options={volumes.map((volume) => ({
                value: volume.id,
                label: `${t("timeline.volume")} ${volume.number} · ${localizedVolumeTitle(volume, language)}`,
              }))}
            />
          </div>
        )}
        {loading ? (
          <EmptyState>{t("common.loading")}</EmptyState>
        ) : visibleGroups.length === 0 ? (
          <EmptyState>{t("timeline.noEvents")}</EmptyState>
        ) : (
          visibleGroups.map((group) => (
            <section key={group.key} className="space-y-3">
              {group.volume && group.chapter ? (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">
                    {t("timeline.volume")} {group.volume.number} ·{" "}
                    {localizedVolumeTitle(group.volume, language)}
                  </p>
                  <h2 className="mt-1 text-lg font-semibold text-stone-900">
                    {formatChapterLabel(
                      {
                        ...group.chapter,
                        title: localizedChapterTitle(group.chapter, language),
                      },
                      kindLabels,
                    )}
                  </h2>
                </div>
              ) : (
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">
                  {t("timeline.unplaced")}
                </p>
              )}
              <div className="relative">
                <div className={timelineRailClassName} />
                <PaginatedTimelineEvents
                  events={group.events}
                  novelId={novelId}
                  characters={characters}
                  isAdmin={isAdmin}
                  editingId={editingId}
                  editForm={editForm}
                  editError={editError}
                  editSaving={editSaving}
                  onEditFormChange={setEditForm}
                  onEdit={startEdit}
                  onEditSubmit={handleEdit}
                  onEditCancel={() => setEditingId(null)}
                  onDelete={setConfirmDeleteEvent}
                  deletingId={deletingId}
                  chapters={chapters}
                  volumes={volumes}
                  roles={roles}
                  onAddCharacter={addCharacter}
                />
              </div>
            </section>
          ))
        )}
        <ConfirmDialog
          open={Boolean(confirmDeleteEvent)}
          eyebrow={t("timeline.confirmEyebrow")}
          title={t("timeline.deleteConfirmTitle")}
          description={t("timeline.deleteConfirmBody", {
            title: confirmDeleteEvent?.title ?? "",
          })}
          confirmLabel={
            deletingId ? t("timeline.deleting") : t("common.delete")
          }
          cancelLabel={t("common.cancel")}
          onConfirm={() => void handleDelete()}
          onCancel={() => setConfirmDeleteEvent(null)}
          busy={deletingId !== null}
          danger
        />
        <Snackbar
          open={Boolean(snackbar)}
          tone={snackbar?.tone}
          message={snackbar?.message}
          onClose={() => setSnackbar(null)}
          closeLabel={t("common.ok")}
        />
      </div>
    </DashboardPage>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-65 items-center justify-center rounded-[22px] border border-dashed border-stone-300 bg-white/70 px-6 py-12 text-center text-sm text-stone-500 shadow-sm">
      {children}
    </div>
  );
}

type TimelineEventListProps = {
  events: NovelEvent[];
  novelId: string;
  characters: CharacterOption[];
  isAdmin: boolean;
  editingId: string | null;
  editForm: FormState;
  editError: string | null;
  editSaving: boolean;
  onEditFormChange: (form: FormState) => void;
  onEdit: (event: NovelEvent) => void;
  onEditSubmit: (event: React.FormEvent) => Promise<void>;
  onEditCancel: () => void;
  onDelete: (event: NovelEvent) => void;
  deletingId: string | null;
  chapters: ChapterOption[];
  volumes: VolumeSearchSource[];
  roles: CharacterRole[];
  onAddCharacter: (name: string, roleId: string) => Promise<CharacterOption>;
};

function PaginatedTimelineEvents(props: TimelineEventListProps) {
  const { t } = useI18n();
  const [storyPageView, setStoryPageView] = useState(1);
  const numberedPages = [
    ...new Set(
      props.events.flatMap((event) =>
        event.page_number === null ? [] : [event.page_number],
      ),
    ),
  ].sort((left, right) => left - right);
  const pages = paginateStoryPages(numberedPages, storyPageView);
  const unnumbered = props.events.filter((event) => event.page_number === null);

  return (
    <div className="space-y-5">
      {pages.items.map((pageNumber) => (
        <TimelineStoryPage
          key={pageNumber}
          label={`${t("timeline.page")} ${pageNumber}`}
          {...props}
          events={props.events.filter(
            (event) => event.page_number === pageNumber,
          )}
        />
      ))}
      {pages.total > 1 && (
        <PaginationControls
          current={pages.current}
          total={pages.total}
          onPrevious={() => setStoryPageView(pages.current - 1)}
          onNext={() => setStoryPageView(pages.current + 1)}
        />
      )}
      {unnumbered.length > 0 && (
        <TimelineStoryPage
          label={t("timeline.pageUnspecified")}
          {...props}
          events={unnumbered}
        />
      )}
    </div>
  );
}

function TimelineStoryPage({
  label,
  events,
  ...props
}: TimelineEventListProps & { label: string }) {
  const [sequenceView, setSequenceView] = useState(1);
  const sequences = paginateStorySequences(events, sequenceView);

  return (
    <div className="space-y-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">
        {label}
      </p>
      <ul className="flex flex-col gap-5">
        {sequences.items.map((event) => (
          <TimelineEventItem
            key={event.id}
            {...props}
            events={events}
            event={event}
          />
        ))}
      </ul>
      {sequences.total > 1 && (
        <PaginationControls
          current={sequences.current}
          total={sequences.total}
          onPrevious={() => setSequenceView(sequences.current - 1)}
          onNext={() => setSequenceView(sequences.current + 1)}
        />
      )}
    </div>
  );
}

function PaginationControls({
  current,
  total,
  onPrevious,
  onNext,
}: {
  current: number;
  total: number;
  onPrevious: () => void;
  onNext: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className="flex items-center justify-end gap-2">
      <button
        type="button"
        disabled={current === 1}
        onClick={onPrevious}
        className={secondaryButtonClassName}>
        {t("common.previous")}
      </button>
      <span className="text-sm text-stone-500">
        {t("common.pageOf", { page: current, total })}
      </span>
      <button
        type="button"
        disabled={current === total}
        onClick={onNext}
        className={secondaryButtonClassName}>
        {t("common.next")}
      </button>
    </div>
  );
}

function TimelineEventItem({
  event,
  events,
  novelId,
  characters,
  isAdmin,
  editingId,
  editForm,
  editError,
  editSaving,
  onEditFormChange,
  onEdit,
  onEditSubmit,
  onEditCancel,
  onDelete,
  deletingId,
  chapters,
  volumes,
  roles,
  onAddCharacter,
}: TimelineEventListProps & { event: NovelEvent }) {
  const { t } = useI18n();
  return (
    <li id={`event-${event.id}`} className="relative pl-8">
      <span className={timelineDotClassName} />
      {editingId === event.id && isAdmin ? (
        <form onSubmit={onEditSubmit} className={cardClassName}>
          <EventFormFields
            form={editForm}
            onChange={onEditFormChange}
            events={events}
            chapters={chapters}
            volumes={volumes}
            characters={characters}
            roles={roles}
            onAddCharacter={onAddCharacter}
          />
          {editError && (
            <p className="mt-2 text-sm text-rose-600">{editError}</p>
          )}
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              disabled={editSaving}
              onClick={onEditCancel}
              className={secondaryButtonClassName}>
              {t("common.cancel")}
            </button>
            <button
              type="submit"
              disabled={editSaving}
              className={primaryButtonClassName}>
              {editSaving ? t("common.saving") : t("common.save")}
            </button>
          </div>
        </form>
      ) : (
        <EventCard
          event={event}
          novelId={novelId}
          characters={characters}
          onEdit={onEdit}
          onDelete={onDelete}
          deleting={deletingId === event.id}
          isAdmin={isAdmin}
          t={t}
        />
      )}
    </li>
  );
}
// The translation function is passed through to keep this presentational card independent of context.

function EventCard({
  event,
  novelId,
  characters,
  onEdit,
  onDelete,
  deleting,
  isAdmin,
  t,
}: {
  event: NovelEvent;
  novelId: string;
  characters: CharacterOption[];
  onEdit: (event: NovelEvent) => void;
  onDelete: (event: NovelEvent) => void;
  deleting: boolean;
  isAdmin: boolean;
  t: ReturnType<typeof useI18n>["t"];
}) {
  return (
    <div className={`${cardClassName} group`}>
      <div className="mb-2 flex items-start justify-between gap-2">
        <p className="text-[15px] font-semibold leading-snug text-stone-900">
          {event.title}
        </p>
        <TimelineEventActions
          isAdmin={isAdmin}
          deleting={deleting}
          editLabel={t("common.edit")}
          deleteLabel={t("common.delete")}
          onEdit={() => onEdit(event)}
          onDelete={() => onDelete(event)}
        />
      </div>
      {event.description && (
        <p className="mb-3 line-clamp-2 text-[13px] leading-relaxed text-stone-600">
          {event.description}
        </p>
      )}
      {event.character_ids.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {event.character_ids.map((id) => {
            const character = characters.find((x) => x.id === id);
            return character ? (
              <Link
                key={id}
                href={`/novels/${novelId}/characters/${id}`}
                className="rounded-full bg-stone-100 px-2.5 py-1 text-xs text-stone-700 ring-1 ring-inset ring-stone-200 hover:bg-stone-200/70">
                {character.name}
              </Link>
            ) : null;
          })}
        </div>
      )}
    </div>
  );
}
function EventFormFields({
  form,
  onChange,
  events,
  chapters,
  volumes,
  characters,
  roles,
  requireChapter = false,
  autoPosition = false,
  onAddCharacter,
}: {
  form: FormState;
  onChange: (form: FormState) => void;
  events: NovelEvent[];
  chapters: ChapterOption[];
  volumes: VolumeSearchSource[];
  characters: CharacterOption[];
  roles: CharacterRole[];
  requireChapter?: boolean;
  autoPosition?: boolean;
  onAddCharacter: (name: string, roleId: string) => Promise<CharacterOption>;
}) {
  const { t, language } = useI18n();
  const labels = useChapterKindLabels();
  const [name, setName] = useState(""),
    [roleId, setRoleId] = useState(""),
    [error, setError] = useState<string | null>(null),
    [saving, setSaving] = useState(false);
  const available = chapters.filter(
    (x) => x.volume_id === form.chapter_volume_id,
  );
  const set =
    (key: Exclude<keyof FormState, "character_ids">) =>
    (
      event: React.ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >,
    ) =>
      onChange({ ...form, [key]: event.target.value });
  function setGroupField(
    field: "chapter_volume_id" | "chapter_id" | "page_number",
    value: string,
  ) {
    const nextForm = {
      ...form,
      [field]: value,
      ...(field === "chapter_volume_id" ? { chapter_id: "" } : {}),
    };
    if (!autoPosition) {
      onChange(nextForm);
      return;
    }
    if (!nextForm.chapter_volume_id || !nextForm.chapter_id) {
      onChange({ ...nextForm, sort_order: "0" });
      return;
    }
    const pageNumber =
      nextForm.page_number === ""
        ? null
        : Number.parseInt(nextForm.page_number, 10);
    onChange({
      ...nextForm,
      sort_order: String(
        nextEventPosition(events, {
          volumeId: nextForm.chapter_volume_id,
          chapterId: nextForm.chapter_id,
          pageNumber: Number.isNaN(pageNumber) ? null : pageNumber,
        }),
      ),
    });
  }
  async function quickAdd() {
    if (!name.trim()) return;
    setError(null);
    setSaving(true);
    try {
      const character = await onAddCharacter(name, roleId);
      onChange({
        ...form,
        character_ids: form.character_ids.includes(character.id)
          ? form.character_ids
          : [...form.character_ids, character.id],
      });
      setName("");
      setRoleId("");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : t("common.networkError"),
      );
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="flex flex-col gap-3">
      <div>
        <label className={smallLabelClassName}>
          {t("common.titleRequired")}
        </label>
        <input
          value={form.title}
          onChange={set("title")}
          required
          className={inputClassName}
          placeholder={t("timeline.field.eventTitlePlaceholder")}
        />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className={smallLabelClassName}>
            {t("timeline.field.volumeRequired")}
          </label>
          <Select
            value={form.chapter_volume_id}
            onValueChange={(value) => setGroupField("chapter_volume_id", value)}
            options={[
              { value: "", label: t("timeline.field.selectVolume") },
              ...volumes.map((volume) => ({
                value: volume.id,
                label: `${t("timeline.volume")} ${volume.number} · ${localizedVolumeTitle(volume, language)}`,
              })),
            ]}
          />
        </div>
        <div>
          <label className={smallLabelClassName}>
            {t("timeline.field.chapterRequired")}
          </label>
          <Select
            value={form.chapter_id}
            aria-required={requireChapter}
            disabled={!form.chapter_volume_id}
            onValueChange={(value) => setGroupField("chapter_id", value)}
            options={[
              { value: "", label: t("timeline.field.selectChapter") },
              ...available.map((chapter) => ({
                value: chapter.id,
                label: formatChapterLabel(
                  {
                    ...chapter,
                    title: localizedChapterTitle(chapter, language),
                  },
                  labels,
                ),
              })),
            ]}
          />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className={smallLabelClassName}>
            {t("timeline.field.page")}
          </label>
          <input
            type="number"
            min="1"
            value={form.page_number}
            onChange={(event) =>
              setGroupField("page_number", event.target.value)
            }
            className={inputClassName}
            placeholder={t("timeline.field.pagePlaceholder")}
          />
        </div>
        <div>
          <label className={smallLabelClassName}>
            {t("timeline.field.sortOrder")}
          </label>
          <input
            type="number"
            value={form.sort_order}
            onChange={set("sort_order")}
            required
            className={inputClassName}
          />
        </div>
      </div>
      <div>
        <label className={smallLabelClassName}>{t("common.description")}</label>
        <textarea
          value={form.description}
          onChange={set("description")}
          rows={2}
          className={inputClassName}
          placeholder={t("timeline.field.optionalDescription")}
        />
      </div>
      <fieldset>
        <legend className={smallLabelClassName}>
          {t("timeline.field.characters")}
        </legend>
        <div className="mt-2 flex max-h-44 flex-wrap gap-2 overflow-y-auto rounded-xl border border-stone-200 p-3">
          {characters.length === 0 ? (
            <p className="text-sm text-stone-500">
              {t("timeline.noCharacters")}
            </p>
          ) : (
            characters.map((character) => (
              <label
                key={character.id}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-stone-100 px-2.5 py-1 text-xs text-stone-700">
                <input
                  type="checkbox"
                  checked={form.character_ids.includes(character.id)}
                  onChange={() =>
                    onChange({
                      ...form,
                      character_ids: form.character_ids.includes(character.id)
                        ? form.character_ids.filter((id) => id !== character.id)
                        : [...form.character_ids, character.id],
                    })
                  }
                  className="accent-stone-900"
                />
                {character.name}
              </label>
            ))
          )}
        </div>
      </fieldset>
      <div className="rounded-xl border border-dashed border-stone-300 p-3">
        <p className={smallLabelClassName}>{t("timeline.quickCharacter")}</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_12rem_auto]">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className={inputClassName}
            placeholder={t("timeline.quickCharacterName")}
          />
          <Select
            value={roleId}
            onValueChange={setRoleId}
            options={[
              { value: "", label: t("timeline.defaultMinor") },
              ...roles.map((role) => ({ value: role.id, label: role.name })),
            ]}
          />
          <button
            type="button"
            onClick={() => void quickAdd()}
            disabled={saving || !name.trim()}
            className={secondaryButtonClassName}>
            {saving ? t("common.saving") : t("timeline.addCharacter")}
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
      </div>
    </div>
  );
}
