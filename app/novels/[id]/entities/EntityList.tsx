"use client";

import Link from "next/link";
import { useState } from "react";
import type { Entity, GenericEntityType } from "@/libs/entities/types";
import { createEntity } from "@/libs/api";
import { useAuth } from "@/components/auth/AuthProvider";
import { useI18n } from "@/components/i18n/I18nProvider";
import {
  emptyStateClassName,
  inputClassName,
  primaryButtonClassName,
} from "../../ui";
import { useSearchMutations } from "@/libs/search/SearchIndexProvider";
import { normalizeEntity } from "@/libs/search/normalize";

const TYPES: GenericEntityType[] = [
  "location",
  "skill",
  "organization",
  "item",
  "concept",
];

export default function EntityList({
  novelId,
  entities: initial,
}: {
  novelId: string;
  entities: Entity[];
}) {
  const { t } = useI18n();
  const { upsert } = useSearchMutations();
  const { isAdmin } = useAuth();
  const [entities, setEntities] = useState(initial);
  const [type, setType] = useState<GenericEntityType>("location");
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  async function add() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const entity = await createEntity(novelId, {
        type,
        name: name.trim(),
        aliases: [],
        description: "",
      });
      upsert(normalizeEntity(entity));
      setEntities((all) =>
        [...all, entity].sort((a, b) => a.name.localeCompare(b.name)),
      );
      setName("");
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="space-y-5">
      {isAdmin && (
        <div className="flex flex-wrap gap-2 rounded-2xl border border-stone-200 bg-white p-4">
          <select
            value={type}
            onChange={(event) =>
              setType(event.target.value as GenericEntityType)
            }
            className={inputClassName}>
            {TYPES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
          <input
            className={inputClassName}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={t("entities.name")}
          />
          <button
            className={primaryButtonClassName}
            onClick={() => void add()}
            disabled={saving || !name.trim()}>
            {saving ? t("common.saving") : t("entities.add")}
          </button>
        </div>
      )}
      {entities.length === 0 ? (
        <div className={emptyStateClassName}>{t("entities.empty")}</div>
      ) : (
        TYPES.map((entityType) => {
          const group = entities.filter((entity) => entity.type === entityType);
          return (
            <section
              key={entityType}
              className="rounded-2xl border border-stone-200 bg-white">
              <h2 className="border-b border-stone-200 px-4 py-3 text-sm font-semibold capitalize">
                {entityType}
              </h2>
              {group.length ? (
                <ul className="divide-y divide-stone-100">
                  {group.map((entity) => (
                    <li key={entity.id}>
                      <Link
                        className="block px-4 py-3 hover:bg-stone-50"
                        href={`/novels/${novelId}/entities/${entity.id}`}>
                        <span className="font-medium">{entity.name}</span>
                        {entity.aliases.length ? (
                          <span className="ml-2 text-sm text-stone-500">
                            {entity.aliases.join(", ")}
                          </span>
                        ) : null}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-4 py-3 text-sm text-stone-500">
                  {t("entities.empty")}
                </p>
              )}
            </section>
          );
        })
      )}
    </div>
  );
}
