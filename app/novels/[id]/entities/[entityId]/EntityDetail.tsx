"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Entity } from "@/libs/entities/types";
import { deleteEntity, updateEntity } from "@/libs/api";
import { useI18n } from "@/components/i18n/I18nProvider";
import { inputClassName, primaryButtonClassName, secondaryButtonClassName } from "../../../ui";
import ConfirmDialog from "../../../ConfirmDialog";
import { useSearchIndex } from "@/libs/search/SearchIndexProvider";
import { normalizeEntity } from "@/libs/search/normalize";
import { dependentRefreshes } from "@/libs/search/refresh";

export default function EntityDetail({ novelId, entity }: { novelId: string; entity: Entity }) {
  const { t } = useI18n(); const { documents, dependents, entityMap, upsertMany, discardMany } = useSearchIndex(); const router = useRouter(); const [name, setName] = useState(entity.name); const [aliases, setAliases] = useState(entity.aliases.join(", ")); const [description, setDescription] = useState(entity.description); const [busy, setBusy] = useState(false); const [confirming, setConfirming] = useState(false);
  async function save() { setBusy(true); try { const updated = await updateEntity(novelId, entity.id, { name: name.trim(), aliases: aliases.split(",").map((value) => value.trim()).filter(Boolean), description }); const nextEntities = new Map(entityMap); nextEntities.set(updated.id, updated); upsertMany([normalizeEntity(updated), ...dependentRefreshes(updated.id, dependents, documents, nextEntities)]); router.refresh(); } finally { setBusy(false); } }
  async function remove() { setBusy(true); try { await deleteEntity(novelId, entity.id); const nextEntities = new Map(entityMap); nextEntities.delete(entity.id); discardMany([`entity:${entity.id}`]); upsertMany(dependentRefreshes(entity.id, dependents, documents, nextEntities)); router.push(`/novels/${novelId}/entities`); } finally { setBusy(false); } }
  return <><section className="space-y-4 rounded-2xl border border-stone-200 bg-white p-5"><p className="text-xs font-semibold uppercase tracking-wide text-stone-500">{entity.type}</p><label className="block text-sm">{t("entities.name")}<input className={inputClassName} value={name} onChange={(event) => setName(event.target.value)} /></label><label className="block text-sm">{t("entities.aliases")}<input className={inputClassName} value={aliases} onChange={(event) => setAliases(event.target.value)} /></label><label className="block text-sm">{t("entities.descriptionField")}<textarea className={inputClassName} value={description} onChange={(event) => setDescription(event.target.value)} rows={5} /></label><div className="flex gap-2"><button className={primaryButtonClassName} onClick={() => void save()} disabled={busy || !name.trim()}>Save</button><button className={secondaryButtonClassName} onClick={() => setConfirming(true)} disabled={busy}>Delete</button></div></section><ConfirmDialog open={confirming} eyebrow="Confirm" title={`Delete ${entity.name}?`} description="This entity will be deleted." confirmLabel="Delete" cancelLabel="Cancel" onConfirm={() => void remove()} onCancel={() => setConfirming(false)} busy={busy} danger /></>;
}
