"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Entity } from "@/libs/entities/types";
import { deleteEntity, updateEntity } from "@/libs/api";
import { useAuth } from "@/components/auth/AuthProvider";
import { useI18n } from "@/components/i18n/I18nProvider";
import {
  FormError,
  inputClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
  Snackbar,
} from "../../../ui";
import ConfirmDialog from "../../../ConfirmDialog";
import { useSearchIndex } from "@/libs/search/SearchIndexProvider";
import { normalizeEntity } from "@/libs/search/normalize";
import { dependentRefreshes } from "@/libs/search/refresh";
import { userErrorMessage } from "@/libs/userErrorMessage";

export default function EntityDetail({
  novelId,
  entity,
}: {
  novelId: string;
  entity: Entity;
}) {
  const { t } = useI18n();
  const { isAdmin, loading } = useAuth();
  const { documents, dependents, entityMap, upsertMany, discardMany } =
    useSearchIndex();
  const router = useRouter();
  const [name, setName] = useState(entity.name);
  const [aliases, setAliases] = useState(entity.aliases.join(", "));
  const [description, setDescription] = useState(entity.description);
  const [busy, setBusy] = useState(false);
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
  if (loading) return null;
  if (!isAdmin) {
    return (
      <section className="space-y-4 rounded-2xl border border-stone-200 bg-white p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
          {entity.type}
        </p>
        <p className="text-sm text-stone-500">{t("entities.readOnly")}</p>
        <dl className="space-y-4 text-sm">
          <div>
            <dt className="font-medium text-stone-500">{t("entities.name")}</dt>
            <dd className="mt-1 text-stone-900">{entity.name}</dd>
          </div>
          <div>
            <dt className="font-medium text-stone-500">{t("entities.aliases")}</dt>
            <dd className="mt-1 text-stone-900">{entity.aliases.join(", ") || "—"}</dd>
          </div>
          <div>
            <dt className="font-medium text-stone-500">{t("entities.descriptionField")}</dt>
            <dd className="mt-1 whitespace-pre-wrap text-stone-900">{entity.description || "—"}</dd>
          </div>
        </dl>
      </section>
    );
  }
  return (
    <>
      <section className="space-y-4 rounded-2xl border border-stone-200 bg-white p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
          {entity.type}
        </p>
        <label className="block text-sm">
          {t("entities.name")}
          <input
            className={inputClassName}
            value={name}
            onChange={(event) => setName(event.target.value)}
            disabled={busy}
          />
        </label>
        {error ? <FormError>{error}</FormError> : null}
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
        <div className="flex gap-2">
            <button
              className={primaryButtonClassName}
              onClick={() => void save()}
              disabled={busy || !name.trim()}>
              {busy ? t("common.saving") : t("common.save")}
            </button>
            <button
              className={secondaryButtonClassName}
              onClick={() => setConfirming(true)}
              disabled={busy}>
              {t("common.delete")}
            </button>
          </div>
      </section>
      <ConfirmDialog
        open={confirming}
        eyebrow="Confirm"
        title={`Delete ${entity.name}?`}
        description="This entity will be deleted."
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
