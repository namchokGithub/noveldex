"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type {
  Adaptation,
  Character,
  CharacterRole,
  NovelEvent,
} from "../../../../types";
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
  const [aliases, setAliases] = useState(character.aliases.join(", "));

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

      <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
        <div className={cardClassName}>
          <p className={smallLabelClassName}>{t("character.role")}</p>
          {editing ? (
            <Select
              value={roleId}
              onValueChange={setRoleId}
              options={roles.map((role) => ({ value: role.id, label: role.name }))}
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

        <div className={`${cardClassName} space-y-5`}>
          {editing && (
            <div>
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

          <div>
            <p className={smallLabelClassName}>{t("character.aliases")}</p>
            {editing ? (
              <input
                value={aliases}
                onChange={(e) => setAliases(e.target.value)}
                placeholder={t("addCharacter.aliasesPlaceholder")}
                className={inputClassName}
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

          <div>
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
                      {ch.read_at}
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
