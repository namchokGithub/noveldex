"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import {
  Brain,
  ChevronDown,
  Lightbulb,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type {
  Adaptation,
  Character,
  CharacterData,
  CharacterRole,
  NovelEvent,
} from "../../../../types";
import type { RichNoteDocument } from "@/libs/richNotes/document";
import {
  cardClassName,
  FormError,
  ghostButtonClassName,
  inputClassName,
  listClassName,
  listRowClassName,
  primaryButtonClassName,
  roleColorClassNames,
  Snackbar,
  secondaryButtonClassName,
  smallLabelClassName,
} from "../../../ui";
import ConfirmDialog from "../../../ConfirmDialog";
import { useI18n } from "@/components/i18n/I18nProvider";
import LocalizedDate from "@/components/i18n/LocalizedDate";
import { ChapterLabel } from "@/components/chapters/ChapterLabel";
import { deleteCharacter, updateCharacter } from "@/libs/api";
import { useAuth } from "@/components/auth/AuthProvider";
import { useResetOnSignOut } from "@/components/auth/useResetOnSignOut";
import { useSearchIndex } from "@/libs/search/SearchIndexProvider";
import { normalizeEntity } from "@/libs/search/normalize";
import { dependentRefreshes } from "@/libs/search/refresh";
import { buildEntityId } from "@/libs/entities/keys";
import { relatedNotesForCharacter } from "@/libs/characterRelatedNotes";
import { crossReferencePreview } from "@/libs/crossReferencePreview";
import { userErrorMessage } from "@/libs/userErrorMessage";
import { Select } from "@/components/ui/Select";
import CharacterProfileImageModal from "./CharacterProfileImageModal";
import {
  RichNoteEditor,
  RichNoteContent,
} from "@/components/notes/RichNoteEditor";

export default function CharacterDetail({
  character,
  novelId,
  roles,
  events,
  adaptations,
}: {
  character: Character;
  novelId: string;
  roles: CharacterRole[];
  events: NovelEvent[];
  adaptations: Adaptation[];
}) {
  const { t } = useI18n();
  const { documents, dependents, entityMap, upsertMany, discardMany } =
    useSearchIndex();
  const { isAdmin } = useAuth();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);

  const [name, setName] = useState(character.name);
  const [roleId, setRoleId] = useState(character.role_id);
  const [profileImageUrl, setProfileImageUrl] = useState(
    character.profile_image_url ?? "",
  );
  const [description, setDescription] = useState(character.description);
  const [appearance, setAppearance] = useState(character.appearance ?? "");
  const [personality, setPersonality] = useState(character.personality ?? "");
  const [trivia, setTrivia] = useState(character.trivia ?? "");
  const [appearanceJson, setAppearanceJson] = useState<
    RichNoteDocument | undefined
  >(character.appearance_content_json);
  const [personalityJson, setPersonalityJson] = useState<
    RichNoteDocument | undefined
  >(character.personality_content_json);
  const [triviaJson, setTriviaJson] = useState<RichNoteDocument | undefined>(
    character.trivia_content_json,
  );
  const [aliases, setAliases] = useState(character.aliases.join(", "));
  const [designData, setDesignData] = useState<CharacterData>(
    character.data ?? {},
  );

  useResetOnSignOut(isAdmin, cancel);

  useEffect(() => {
    if (!snackbar) return;
    const timeoutId = window.setTimeout(() => setSnackbar(null), 3000);
    return () => window.clearTimeout(timeoutId);
  }, [snackbar]);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const updated = await updateCharacter(novelId, character.id, {
        name,
        role_id: roleId,
        profile_image_url: profileImageUrl.trim() || null,
        description,
        aliases: aliases
          ? aliases
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          : [],
        appearance,
        personality,
        trivia,
        appearance_content_json: appearanceJson,
        personality_content_json: personalityJson,
        trivia_content_json: triviaJson,
        data: sanitizeCharacterData(designData),
      });
      const entity = {
        id: buildEntityId(novelId, "character", updated.id),
        novelId,
        type: "character" as const,
        name: updated.name,
        aliases: updated.aliases,
        description: updated.description,
      };
      const nextEntities = new Map(entityMap);
      nextEntities.set(entity.id, entity);
      upsertMany([
        normalizeEntity(entity),
        ...dependentRefreshes(entity.id, dependents, documents, nextEntities),
      ]);
      setEditing(false);
      setSnackbar({ tone: "success", message: t("character.saveSuccess") });
      router.refresh();
    } catch (cause) {
      const message = userErrorMessage(cause, t);
      setError(message);
      setSnackbar({ tone: "error", message });
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    setSaving(true);
    setError(null);
    try {
      await deleteCharacter(novelId, character.id);
      const entityId = buildEntityId(novelId, "character", character.id);
      const nextEntities = new Map(entityMap);
      nextEntities.delete(entityId);
      discardMany([entityId]);
      upsertMany(
        dependentRefreshes(entityId, dependents, documents, nextEntities),
      );
      router.push(`/novels/${novelId}/characters`);
    } catch (cause) {
      const message = userErrorMessage(cause, t);
      setError(message);
      setSnackbar({ tone: "error", message });
    } finally {
      setSaving(false);
    }
  }

  function cancel() {
    setName(character.name);
    setRoleId(character.role_id);
    setProfileImageUrl(character.profile_image_url ?? "");
    setDescription(character.description);
    setAliases(character.aliases.join(", "));
    setAppearance(character.appearance ?? "");
    setPersonality(character.personality ?? "");
    setTrivia(character.trivia ?? "");
    setAppearanceJson(character.appearance_content_json);
    setPersonalityJson(character.personality_content_json);
    setTriviaJson(character.trivia_content_json);
    setDesignData(character.data ?? {});
    setEditing(false);
    setError(null);
  }

  const displayRole = character.role_name ?? character.role;
  const relatedNotes = relatedNotesForCharacter(
    character.chapters ?? [],
    character.id,
  );
  const eventPreview = crossReferencePreview(events);
  const adaptationPreview = crossReferencePreview(adaptations);

  return (
    <div className="flex flex-col gap-6">
      <div className={cardClassName}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-4">
            <CharacterProfileImageModal
              name={character.name}
              profileImageUrl={character.profile_image_url}
            />
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full bg-stone-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-500">
                {t("character.profile")}
              </div>
              <p className="text-xs text-stone-500">
                {t("common.updated")}:{" "}
                <LocalizedDate value={character.updated_at} />
              </p>
              {editing ? (
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={`${inputClassName} text-2xl font-semibold tracking-[-0.04em]`}
                />
              ) : (
                <h1 className="text-3xl font-semibold tracking-[-0.04em] text-stone-950">
                  {character.name}
                </h1>
              )}
            </div>
          </div>
          {editing ? (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                disabled={saving}
                className={`${secondaryButtonClassName} border-rose-200 text-rose-700 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-800 focus-visible:ring-rose-200`}>
                {t("common.delete")}
              </button>
              <button
                onClick={cancel}
                disabled={saving}
                className={ghostButtonClassName}>
                {t("common.cancel")}
              </button>
              <button
                onClick={save}
                disabled={saving}
                className={primaryButtonClassName}>
                {saving ? t("common.saving") : t("common.save")}
              </button>
            </div>
          ) : isAdmin ? (
            <button
              onClick={() => setEditing(true)}
              className={secondaryButtonClassName}>
              {t("common.edit")}
            </button>
          ) : null}
        </div>
      </div>

      {error && <FormError>{error}</FormError>}

      <div className="grid items-start gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="space-y-4">
          <div className={`${cardClassName} h-fit`}>
            <p className={smallLabelClassName}>{t("character.role")}</p>
            {editing ? (
              <Select
                value={roleId}
                onValueChange={setRoleId}
                options={roles.map((role) => ({
                  value: role.id,
                  label: role.name,
                }))}
              />
            ) : (
              <span
                className={`inline-block rounded-full px-2.5 py-1 text-[11px] font-semibold ${roleColorClassNames[character.role] ?? roleColorClassNames.minor}`}>
                {displayRole}
              </span>
            )}

            <div className="mt-6 border-t border-stone-200 pt-5">
              <p className={smallLabelClassName}>
                {t("character.chapterAppearances")}
              </p>
              <p className="text-3xl font-semibold tracking-tighter text-stone-950">
                {character.chapter_count}
              </p>
            </div>
          </div>

          <CharacterDataSections
            data={designData}
            editing={editing}
            onChange={setDesignData}
          />
        </div>

        <div className="space-y-4">
          {editing && (
            <div className={cardClassName}>
              <label className={smallLabelClassName}>
                {t("addCharacter.profileImageUrl")}
              </label>
              <input
                value={profileImageUrl}
                onChange={(e) => setProfileImageUrl(e.target.value)}
                type="url"
                placeholder="https://example.com/image.jpg"
                className={inputClassName}
              />
            </div>
          )}

          <div className={`${cardClassName} space-y-4`}>
            <p className={smallLabelClassName}>{t("character.aliases")}</p>
            {editing ? (
              <input
                value={aliases}
                onChange={(e) => setAliases(e.target.value)}
                placeholder={t("addCharacter.aliasesPlaceholder")}
                className={inputClassName}
                onKeyDown={(event) => {
                  if (event.key !== " " || event.nativeEvent.isComposing)
                    return;
                  const input = event.currentTarget;
                  const start = input.selectionStart ?? input.value.length;
                  const end = input.selectionEnd ?? start;
                  const before = input.value.slice(0, start);
                  const after = input.value.slice(end);
                  if (!before.trim() || before.trimEnd().endsWith(",")) return;
                  event.preventDefault();
                  const next = `${before.trimEnd()}, ${after.trimStart()}`;
                  setAliases(next);
                  const cursor = before.trimEnd().length + 2;
                  requestAnimationFrame(() =>
                    input.setSelectionRange(cursor, cursor),
                  );
                }}
              />
            ) : (
              <p className="text-sm leading-6 text-stone-600">
                {character.aliases.length > 0 ? (
                  character.aliases.join(", ")
                ) : (
                  <span className="text-stone-400">{t("common.none")}</span>
                )}
              </p>
            )}
          </div>

          <div className={`${cardClassName} space-y-4`}>
            <p className={smallLabelClassName}>{t("common.description")}</p>
            {editing ? (
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className={inputClassName}
                placeholder={t("addCharacter.descriptionPlaceholder")}
              />
            ) : (
              <p className="text-sm leading-7 text-stone-600">
                {character.description || (
                  <span className="text-stone-400">
                    {t("character.noDescription")}
                  </span>
                )}
              </p>
            )}
          </div>

          <CharacterRichField
            label={t("character.appearance")}
            icon={UserRound}
            value={appearance}
            editing={editing}
            onChange={setAppearance}
            initialContentJson={appearanceJson}
            onContentJsonChange={setAppearanceJson}
          />
          <CharacterRichField
            label={t("character.personality")}
            icon={Brain}
            value={personality}
            editing={editing}
            onChange={setPersonality}
            initialContentJson={personalityJson}
            onContentJsonChange={setPersonalityJson}
          />
          <CharacterRichField
            label={t("character.trivia")}
            icon={Lightbulb}
            value={trivia}
            editing={editing}
            onChange={setTrivia}
            initialContentJson={triviaJson}
            onContentJsonChange={setTriviaJson}
          />
        </div>
      </div>

      {character.chapters && character.chapters.length > 0 && (
        <div className={cardClassName}>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.24em] text-stone-500">
            {t("character.appearsIn", { count: character.chapter_count })}
          </h2>
          <ul className={`${listClassName} divide-y divide-stone-200`}>
            {character.chapters.map((ch) => (
              <li key={ch.id}>
                <Link
                  href={`/novels/${novelId}/volumes/${ch.volume_id}/chapters/${ch.id}`}
                  className={`${listRowClassName} flex-wrap`}>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-stone-900">
                    <ChapterLabel chapter={ch} />
                  </span>
                  {ch.read_at && (
                    <span className="shrink-0 text-xs text-stone-500">
                      <LocalizedDate value={ch.read_at} />
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {relatedNotes.length > 0 && (
        <div className={cardClassName}>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.24em] text-stone-500">
            {t("character.relatedNotes")}
          </h2>
          <ul className={`${listClassName} divide-y divide-stone-200`}>
            {relatedNotes.map(({ chapterId, note }) => {
              const chapter = character.chapters?.find(
                (item) => item.id === chapterId,
              );
              if (!chapter) return null;
              return (
                <li key={`${chapterId}-${note.id}`}>
                  <Link
                    href={`/novels/${novelId}/volumes/${chapter.volume_id}/chapters/${chapterId}?note=${encodeURIComponent(note.id)}`}
                    className={`${listRowClassName} block`}>
                    <p className="text-sm font-medium text-stone-900">
                      <ChapterLabel chapter={chapter} />
                    </p>
                    <p className="mt-1 line-clamp-2 text-sm leading-6 text-stone-600">
                      {note.content}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {(events.length > 0 || adaptations.length > 0) && (
        <section className={cardClassName}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-500">
            {t("character.relatedRecords")}
          </p>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {events.length > 0 ? (
              <div className="rounded-2xl bg-stone-50 p-4 ring-1 ring-stone-200/70">
                <h2 className="font-semibold text-stone-900">
                  {t("character.timelineEvents")}
                </h2>
                <div className="mt-3 space-y-2">
                  {eventPreview.items.map((event) => (
                    <Link
                      key={event.id}
                      href={`/novels/${novelId}/timeline`}
                      className="block rounded-xl px-2 py-1.5 text-sm text-stone-700 transition hover:bg-white hover:text-stone-950">
                      {event.title || t("timeline.title")}
                    </Link>
                  ))}
                  {eventPreview.remaining > 0 ? (
                    <Link
                      href={`/novels/${novelId}/timeline`}
                      className="block px-2 py-1.5 text-sm font-medium text-stone-600 hover:text-stone-950">
                      {t("character.viewTimeline", {
                        count: eventPreview.remaining,
                      })}
                    </Link>
                  ) : null}
                </div>
              </div>
            ) : null}

            {adaptations.length > 0 ? (
              <div className="rounded-2xl bg-stone-50 p-4 ring-1 ring-stone-200/70">
                <h2 className="font-semibold text-stone-900">
                  {t("character.adaptations")}
                </h2>
                <div className="mt-3 space-y-2">
                  {adaptationPreview.items.map((adaptation) => (
                    <Link
                      key={adaptation.id}
                      href={`/novels/${novelId}/adaptations#adaptation-${adaptation.id}`}
                      className="block rounded-xl px-2 py-1.5 text-sm text-stone-700 transition hover:bg-white hover:text-stone-950">
                      <span className="font-medium">{adaptation.title}</span>
                      <span className="ml-2 text-xs text-stone-400">
                        {adaptation.medium} · {adaptation.entry_type}{" "}
                        {adaptation.entry_number}
                      </span>
                    </Link>
                  ))}
                  {adaptationPreview.remaining > 0 ? (
                    <Link
                      href={`/novels/${novelId}/adaptations`}
                      className="block px-2 py-1.5 text-sm font-medium text-stone-600 hover:text-stone-950">
                      {t("character.viewAdaptations", {
                        count: adaptationPreview.remaining,
                      })}
                    </Link>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        </section>
      )}

      <Snackbar
        open={Boolean(snackbar)}
        tone={snackbar?.tone}
        message={snackbar?.message}
        onClose={() => setSnackbar(null)}
        closeLabel={t("common.ok")}
      />
      <ConfirmDialog
        open={confirmingDelete}
        eyebrow={t("characters.eyebrow")}
        title={t("character.deleteConfirmTitle", { name: character.name })}
        description={t("character.deleteConfirmBody")}
        confirmLabel={saving ? t("common.deleting") : t("common.delete")}
        cancelLabel={t("common.cancel")}
        onConfirm={() => void remove()}
        onCancel={() => setConfirmingDelete(false)}
        busy={saving}
        danger
      />
    </div>
  );
}

type DesignField = {
  key: string;
  label: string;
  section: string;
  multiple?: boolean;
};

function sanitizeCharacterData(data: CharacterData): CharacterData {
  const result = structuredClone(data);
  for (const group of Object.values(result)) {
    if (!group) continue;
    for (const [key, value] of Object.entries(group)) {
      if (Array.isArray(value)) {
        (group as Record<string, unknown>)[key] = value.filter(Boolean);
      }
    }
  }
  return result;
}

const designFields: Array<{
  key: "biographical_and_biological" | "social" | "debut";
  label: string;
  fields: DesignField[];
}> = [
  {
    key: "biographical_and_biological",
    label: "Biographical and Biological",
    fields: [
      { key: "name_thai", label: "Name Thai", section: "Names" },
      { key: "name_japanese", label: "Name Japanese", section: "Names" },
      { key: "romaji", label: "Rōmaji", section: "Names" },
      {
        key: "blessings",
        label: "Blessing(s)",
        section: "Biology",
        multiple: true,
      },
      { key: "species", label: "Species", section: "Biology" },
      { key: "kind", label: "Kind", section: "Biology" },
      { key: "age", label: "Age", section: "Biology" },
      { key: "height", label: "Height", section: "Biology" },
      { key: "length", label: "Length", section: "Biology" },
      { key: "hair_color", label: "Hair Color", section: "Appearance" },
      { key: "eye_color", label: "Eye Color", section: "Appearance" },
      { key: "status", label: "Status", section: "Appearance" },
    ],
  },
  {
    key: "social",
    label: "Social",
    fields: [
      {
        key: "country_of_residence",
        label: "Country of Residence",
        section: "Base",
      },
      {
        key: "base_of_operations",
        label: "Base of Operations",
        section: "Base",
      },
      {
        key: "occupations",
        label: "Occupation(s)",
        section: "Roles and Ratings",
        multiple: true,
      },
      {
        key: "classes",
        label: "Class(s)",
        section: "Roles and Ratings",
        multiple: true,
      },
      { key: "rank", label: "Rank", section: "Roles and Ratings" },
      {
        key: "danger_ratings",
        label: "Danger Rating(s)",
        section: "Roles and Ratings",
        multiple: true,
      },
      {
        key: "adventurer_rank",
        label: "Adventurer Rank",
        section: "Roles and Ratings",
      },
      {
        key: "affiliations",
        label: "Affiliation(s)",
        section: "Affiliations",
        multiple: true,
      },
      {
        key: "former_affiliations",
        label: "Former Affiliation(s)",
        section: "Affiliations",
        multiple: true,
      },
    ],
  },
  {
    key: "debut",
    label: "Debut",
    fields: [
      { key: "web_novel", label: "Web Novel", section: "Media" },
      { key: "light_novel", label: "Light Novel", section: "Media" },
      { key: "manga", label: "Manga", section: "Media" },
      { key: "anime", label: "Anime", section: "Media" },
    ],
  },
];

function CharacterDataSections({
  data,
  editing,
  onChange,
}: {
  data: CharacterData;
  editing: boolean;
  onChange: (data: CharacterData) => void;
}) {
  const populated = (value: unknown) =>
    Array.isArray(value) ? value.length > 0 : Boolean(value);

  return (
    <div className="space-y-4">
      {designFields.map((group) => {
        const values = data[group.key] ?? {};
        const hasValues = group.fields.some(({ key }) =>
          populated((values as Record<string, unknown>)[key]),
        );
        if (!editing && !hasValues) return null;
        return (
          <details
            key={group.key}
            open={editing || undefined}
            className={`${cardClassName} group space-y-4`}>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-stone-500 [&::-webkit-details-marker]:hidden">
              {group.label}
              <ChevronDown
                aria-hidden="true"
                size={16}
                strokeWidth={1.8}
                className="text-stone-400 transition-transform group-open:rotate-180"
              />
            </summary>
            <div className="space-y-3">
              {Array.from(
                new Set(group.fields.map((field) => field.section)),
              ).map((section) => {
                const sectionFields = group.fields.filter(
                  (field) => field.section === section,
                );
                return (
                  <div
                    key={section}
                    className="rounded-2xl bg-stone-50/70 p-3 ring-1 ring-stone-200/50">
                    <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-stone-500">
                      {section}
                    </p>
                    <div className="grid grid-cols-1 gap-x-5 gap-y-5 sm:grid-cols-2">
                      {sectionFields.map((field) => {
                        const raw = (values as Record<string, unknown>)[
                          field.key
                        ];
                        const value = Array.isArray(raw)
                          ? (editing ? raw : raw.filter(Boolean)).join(", ")
                          : String(raw ?? "");
                        if (!editing && !value) return null;
                        return (
                          <Fragment key={field.key}>
                            <div
                              className={
                                field.multiple
                                  ? "min-w-0 sm:col-span-2"
                                  : "min-w-0"
                              }>
                              <p className="text-[11px] font-medium text-stone-500">
                                {field.label}
                              </p>
                              {editing ? (
                                <input
                                  value={value}
                                  {...(!field.multiple
                                    ? { maxLength: 100 }
                                    : {})}
                                  onKeyDown={(event) => {
                                    if (
                                      !field.multiple ||
                                      event.key !== " " ||
                                      event.nativeEvent.isComposing
                                    )
                                      return;
                                    const input = event.currentTarget;
                                    const start =
                                      input.selectionStart ??
                                      input.value.length;
                                    const end = input.selectionEnd ?? start;
                                    const before = input.value.slice(0, start);
                                    const after = input.value.slice(end);
                                    if (
                                      !before.trim() ||
                                      before.trimEnd().endsWith(",")
                                    )
                                      return;
                                    event.preventDefault();
                                    const next = `${before.trimEnd()}, ${after.trimStart()}`;
                                    onChange({
                                      ...data,
                                      [group.key]: {
                                        ...values,
                                        [field.key]: next
                                          .split(",")
                                          .map((item) => item.trim()),
                                      },
                                    });
                                    const cursor = before.trimEnd().length + 2;
                                    requestAnimationFrame(() =>
                                      input.setSelectionRange(cursor, cursor),
                                    );
                                  }}
                                  onChange={(event) => {
                                    const nextValue = field.multiple
                                      ? event.target.value
                                          .split(",")
                                          .map((item) => item.trim())
                                      : event.target.value;
                                    onChange({
                                      ...data,
                                      [group.key]: {
                                        ...values,
                                        [field.key]: nextValue,
                                      },
                                    });
                                  }}
                                  className={`${inputClassName} mt-1 text-sm`}
                                />
                              ) : group.key === "debut" ? (
                                <span className="mt-2 inline-flex rounded-full bg-white px-2.5 py-1 text-xs font-medium text-stone-700 ring-1 ring-stone-200/80">
                                  {value}
                                </span>
                              ) : field.multiple && Array.isArray(raw) ? (
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                  {raw.filter(Boolean).map((item) => (
                                    <span
                                      key={item}
                                      className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-stone-700 ring-1 ring-stone-200/80">
                                      {item}
                                    </span>
                                  ))}
                                </div>
                              ) : field.key === "status" ? (
                                <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-100">
                                  <span
                                    aria-hidden="true"
                                    className="h-1.5 w-1.5 rounded-full bg-emerald-400"
                                  />
                                  {value}
                                </span>
                              ) : (
                                <p className="mt-1 text-[15px] leading-6 text-stone-800">
                                  {value}
                                </p>
                              )}
                            </div>
                          </Fragment>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </details>
        );
      })}
    </div>
  );
}

function CharacterRichField({
  label,
  icon: Icon,
  value,
  editing,
  onChange,
  initialContentJson,
  onContentJsonChange,
}: {
  label: string;
  icon: LucideIcon;
  value: string;
  editing: boolean;
  onChange: (value: string) => void;
  initialContentJson?: RichNoteDocument;
  onContentJsonChange: (value: RichNoteDocument) => void;
}) {
  const { t } = useI18n();
  const previewRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [canExpand, setCanExpand] = useState(false);

  useEffect(() => {
    const element = previewRef.current;
    if (!element) return;
    if (expanded) return;
    const updateOverflow = () =>
      setCanExpand(element.scrollHeight > element.clientHeight + 1);
    const frame = requestAnimationFrame(updateOverflow);
    const observer = new ResizeObserver(updateOverflow);
    observer.observe(element);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [value, initialContentJson, expanded]);

  return (
    <div className={`${cardClassName} space-y-3`}>
      <div
        title={label}
        className="flex items-center gap-2 border-b border-stone-200/60 pb-3">
        <Icon
          aria-hidden="true"
          size={15}
          strokeWidth={1.7}
          className="text-stone-400"
        />
        <p className={`${smallLabelClassName} mb-0!`}>{label}</p>
      </div>
      {editing ? (
        <RichNoteEditor
          initialContent={value}
          entities={[]}
          enableEntityReferences={false}
          initialContentJson={initialContentJson}
          onChange={({ content, contentJson }) => {
            onChange(content);
            onContentJsonChange(contentJson);
          }}
        />
      ) : value ? (
        <>
          <div
            ref={previewRef}
            className={expanded ? undefined : "line-clamp-3 overflow-hidden"}>
            <RichNoteContent content={value} contentJson={initialContentJson} />
          </div>
          {canExpand ? (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setExpanded((current) => !current)}
                className="text-sm font-medium text-stone-500 underline decoration-stone-300 underline-offset-4 hover:text-stone-900">
                {expanded ? t("character.showLess") : t("character.showMore")}
              </button>
            </div>
          ) : null}
        </>
      ) : (
        <p className="text-sm leading-7 text-stone-400">—</p>
      )}
    </div>
  );
}
