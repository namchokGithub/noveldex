"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Entity, GenericEntityType } from "@/libs/entities/types";
import { useI18n } from "@/components/i18n/I18nProvider";
import {
  emptyStateClassName,
  secondaryButtonClassName,
} from "../../ui";
import { entityTypeBadgeStyle } from "@/libs/richNotes/tagColors";
import { Select } from "@/components/ui/Select";

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
  selectedType,
  cursorHistory,
  nextCursorByType,
}: {
  novelId: string;
  entities: Entity[];
  selectedType: GenericEntityType | null;
  cursorHistory: string[];
  nextCursorByType: Partial<Record<GenericEntityType, string>>;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const entities = initial;
  function typeHref(entityType: GenericEntityType, cursors: string[] = []) {
    const params = new URLSearchParams({ type: entityType });
    if (cursors.length) params.set("after", cursors.join(","));
    return `/novels/${novelId}/entities?${params.toString()}`;
  }
  const allTypesHref = `/novels/${novelId}/entities?type=all`;
  const visibleTypes = selectedType ? [selectedType] : TYPES;
  const filterValue = selectedType ?? "all";

  function changeFilter(value: string) {
    router.push(
      value === "all"
        ? `/novels/${novelId}/entities?type=all`
        : `/novels/${novelId}/entities?type=${value}`,
    );
  }

  return (
    <div className="space-y-5">
      <div className="relative z-30 flex flex-wrap items-center gap-3 overflow-visible rounded-2xl border border-stone-200 bg-white p-4">
        <label
          htmlFor="entity-type-filter"
          className="text-sm font-medium text-stone-700">
          {t("entities.filterType")}
        </label>
        <Select
          value={filterValue}
          onValueChange={changeFilter}
          id="entity-type-filter"
          wrapperClassName="w-56"
          options={[
            { value: "all", label: t("entities.allTypes") },
            { value: "location", label: "location" },
            { value: "skill", label: "skill" },
            { value: "organization", label: "organization" },
            { value: "item", label: "item" },
            { value: "concept", label: "concept" },
          ]}
          aria-label={t("entities.filterType")}
        />
      </div>
      {entities.length === 0 ? (
        <div className={emptyStateClassName}>{t("entities.empty")}</div>
      ) : (
        visibleTypes.map((entityType) => {
          const group = entities.filter((entity) => entity.type === entityType);
          const nextCursor = nextCursorByType[entityType];
          return (
            <section
              key={entityType}
              className="rounded-2xl border border-stone-200 bg-white">
              <h2 className="border-b border-stone-200 px-4 py-3">
                <span
                  className="inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold capitalize tracking-wide"
                  style={entityTypeBadgeStyle(entityType)}>
                  {entityType}
                </span>
              </h2>
              {group.length ? (
                <>
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
                  {selectedType ? (
                    <div className="flex items-center justify-between gap-2 border-t border-stone-100 px-4 py-3">
                      {cursorHistory.length ? (
                        <Link
                          href={typeHref(
                            entityType,
                            cursorHistory.slice(0, -1),
                          )}
                          className={secondaryButtonClassName}>
                          {t("common.previous")}
                        </Link>
                      ) : (
                        <Link
                          href={allTypesHref}
                          className={secondaryButtonClassName}>
                          {t("entities.allTypes")}
                        </Link>
                      )}
                      {nextCursor ? (
                        <Link
                          href={typeHref(entityType, [
                            ...cursorHistory,
                            nextCursor,
                          ])}
                          className={secondaryButtonClassName}>
                          {t("common.next")}
                        </Link>
                      ) : null}
                    </div>
                  ) : nextCursor ? (
                    <div className="border-t border-stone-100 px-4 py-3">
                      <Link
                        href={typeHref(entityType)}
                        className="text-sm font-medium text-stone-600 underline decoration-stone-300 underline-offset-4 transition hover:text-stone-950">
                        {t("entities.viewAll")}
                      </Link>
                    </div>
                  ) : null}
                </>
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
