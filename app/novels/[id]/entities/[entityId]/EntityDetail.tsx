"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Entity } from "@/libs/entities/types";
import { deleteEntity, updateEntity, updateEntityGallery } from "@/libs/api";
import type { GalleryImage } from "@/app/types";
import { useAuth } from "@/components/auth/AuthProvider";
import { type TranslationKey, useI18n } from "@/components/i18n/I18nProvider";
import {
  FormError,
  inputClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
  Snackbar,
} from "../../../ui";
import ConfirmDialog from "../../../ConfirmDialog";
import { useSearchIndex } from "@/libs/search/SearchIndexProvider";
import { useResetOnSignOut } from "@/components/auth/useResetOnSignOut";
import { normalizeEntity } from "@/libs/search/normalize";
import { dependentRefreshes } from "@/libs/search/refresh";
import { userErrorMessage } from "@/libs/userErrorMessage";
import CharacterGallery from "../../characters/[characterId]/CharacterGallery";

export default function EntityDetail({
  novelId,
  entity,
}: {
  novelId: string;
  entity: Entity;
}) {
  const { t } = useI18n();
  const entityTypeLabel = t(
    `command.resultType.${entity.type}` as TranslationKey,
  );
  const { isAdmin, loading } = useAuth();
  const { documents, dependents, entityMap, upsertMany, discardMany } =
    useSearchIndex();
  const router = useRouter();
  const [name, setName] = useState(entity.name);
  const [aliases, setAliases] = useState(entity.aliases.join(", "));
  const [description, setDescription] = useState(entity.description);
  const [gallery, setGallery] = useState<GalleryImage[]>(entity.gallery ?? []);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);

  useEffect(() => {
    if (!snackbar) return;
    const timeoutId = window.setTimeout(() => setSnackbar(null), 3000);
    return () => window.clearTimeout(timeoutId);
  }, [snackbar]);

  function cancel() {
    setName(entity.name);
    setAliases(entity.aliases.join(", "));
    setDescription(entity.description);
    setEditing(false);
    setError(null);
  }

  useResetOnSignOut(isAdmin, cancel);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const updated = await updateEntity(novelId, entity.id, {
        name: name.trim(),
        aliases: aliases
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
        description,
      });
      const nextEntities = new Map(entityMap);
      nextEntities.set(updated.id, updated);
      upsertMany([
        normalizeEntity(updated),
        ...dependentRefreshes(updated.id, dependents, documents, nextEntities),
      ]);
      setEditing(false);
      setSnackbar({ tone: "success", message: t("entities.saveSuccess") });
      router.refresh();
    } catch (cause) {
      const message = userErrorMessage(cause, t);
      setError(message);
      setSnackbar({ tone: "error", message });
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    setBusy(true);
    setError(null);
    try {
      await deleteEntity(novelId, entity.id);
      const nextEntities = new Map(entityMap);
      nextEntities.delete(entity.id);
      discardMany([`entity:${entity.id}`]);
      upsertMany(
        dependentRefreshes(entity.id, dependents, documents, nextEntities),
      );
      router.push(`/novels/${novelId}/entities`);
    } catch (cause) {
      const message = userErrorMessage(cause, t);
      setError(message);
      setSnackbar({ tone: "error", message });
    } finally {
      setBusy(false);
    }
  }
  async function saveGallery(nextGallery: GalleryImage[]) {
    setError(null);
    try {
      await updateEntityGallery(novelId, entity.id, nextGallery);
      setGallery(nextGallery);
      setSnackbar({ tone: "success", message: t("entities.saveSuccess") });
      router.refresh();
    } catch (cause) {
      const message = userErrorMessage(cause, t);
      setError(message);
      setSnackbar({ tone: "error", message });
      throw cause;
    }
  }
  if (loading) return null;
  return (
    <>
      <section className="space-y-4 rounded-2xl border border-stone-200 bg-white p-5">
        <div className="flex items-start justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
            {entityTypeLabel}
          </p>
          {!editing && isAdmin ? (
            <button
              type="button"
              className={secondaryButtonClassName}
              onClick={() => setEditing(true)}>
              {t("common.edit")}
            </button>
          ) : null}
        </div>
        {editing ? (
          <>
            <label className="block text-sm">
              {t("entities.name")}
              <input
                className={inputClassName}
                value={name}
                onChange={(event) => setName(event.target.value)}
                disabled={busy}
              />
            </label>
            <label className="block text-sm">
              {t("entities.aliases")}
              <input
                className={inputClassName}
                value={aliases}
                onChange={(event) => setAliases(event.target.value)}
                disabled={busy}
              />
            </label>
            <label className="block text-sm">
              {t("entities.descriptionField")}
              <textarea
                className={inputClassName}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={5}
                disabled={busy}
              />
            </label>
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-stone-200 pt-5">
              <button
                type="button"
                className={`${secondaryButtonClassName} border-rose-200 text-rose-700 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-800 focus-visible:ring-rose-200`}
                onClick={() => setConfirming(true)}
                disabled={busy}>
                {t("common.delete")}
              </button>
              <div className="ml-auto flex flex-wrap gap-2">
                <button
                  type="button"
                  className={secondaryButtonClassName}
                  onClick={cancel}
                  disabled={busy}>
                  {t("common.cancel")}
                </button>
                <button
                  type="button"
                  className={primaryButtonClassName}
                  onClick={() => void save()}
                  disabled={busy || !name.trim()}>
                  {busy ? t("common.saving") : t("common.save")}
                </button>
              </div>
            </div>
          </>
        ) : (
          <dl className="space-y-4 text-sm">
            <div>
              <dt className="font-medium text-stone-500">
                {t("entities.name")}
              </dt>
              <dd className="mt-1 text-stone-900">{entity.name}</dd>
            </div>
            <div>
              <dt className="font-medium text-stone-500">
                {t("entities.aliases")}
              </dt>
              <dd className="mt-1 text-stone-900">
                {entity.aliases.join(", ") || "—"}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-stone-500">
                {t("entities.descriptionField")}
              </dt>
              <dd className="mt-1 whitespace-pre-wrap text-stone-900">
                {entity.description || "—"}
              </dd>
            </div>
          </dl>
        )}
        {error ? <FormError>{error}</FormError> : null}
      </section>
      <CharacterGallery gallery={gallery} canEdit={isAdmin} onSave={saveGallery} />
      <ConfirmDialog
        open={confirming}
        eyebrow={t("entities.deleteEyebrow")}
        title={t("entities.deleteTitle", { name: entity.name })}
        description={t("entities.deleteDescription")}
        confirmLabel={busy ? t("common.deleting") : t("common.delete")}
        cancelLabel={t("common.cancel")}
        onConfirm={() => void remove()}
        onCancel={() => setConfirming(false)}
        busy={busy}
        danger
      />
      <Snackbar
        open={Boolean(snackbar)}
        tone={snackbar?.tone}
        message={snackbar?.message}
        onClose={() => setSnackbar(null)}
        closeLabel={t("common.ok")}
      />
    </>
  );
}
