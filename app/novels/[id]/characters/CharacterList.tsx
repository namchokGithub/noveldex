"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import type { Character, CharacterRole, PaginationMeta } from "@/app/types";
import type { CharacterSort, SortDirection } from "@/app/types";
import {
  emptyStateClassName,
  listClassName,
  listRowClassName,
  roleColorClassNames,
  secondaryButtonClassName,
  inputClassName,
} from "../../ui";
import { T } from "@/components/i18n/I18nProvider";
import { useRouter } from "next/navigation";
import { buildCursorPageSearch, canNavigatePage } from "@/libs/pagination";
import { Select } from "@/components/ui/Select";
import LocalizedDate from "@/components/i18n/LocalizedDate";

export default function CharacterList({
  novelId,
  characters,
  pagination,
  previousCursor,
  nextCursor,
  roles,
  roleId,
  search,
  sort,
  direction,
}: {
  novelId: string;
  characters: Character[];
  pagination: PaginationMeta;
  previousCursor: string | null;
  nextCursor: string | null;
  roles: CharacterRole[];
  roleId: string | null;
  search: string;
  sort: CharacterSort;
  direction: SortDirection;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handlePerPageChange(nextPerPage: number) {
    router.push(
      `${pathname}?${buildCursorPageSearch(searchParams.toString(), {
        page: 1,
        perPage: nextPerPage,
        cursor: null,
      })}`,
    );
  }

  function handleRoleChange(nextRoleId: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", "1");
    params.delete("after");
    params.delete("before");
    if (nextRoleId) params.set("role", nextRoleId);
    else params.delete("role");
    router.push(`${pathname}?${params.toString()}`);
  }

  function resetWith(next: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", "1");
    params.delete("after");
    params.delete("before");
    Object.entries(next).forEach(([key, value]) => {
      if (value) params.set(key, value);
      else params.delete(key);
    });
    router.push(`${pathname}?${params.toString()}`);
  }

  if (characters.length === 0 && pagination.page === 1 && !search && !roleId) {
    return (
      <div className={emptyStateClassName}>
        <T k="characters.noCharacters" />
      </div>
    );
  }

  const rangeStart =
    pagination.total_items === 0
      ? 0
      : (pagination.page - 1) * pagination.per_page + 1;
  const rangeEnd = Math.min(
    pagination.page * pagination.per_page,
    pagination.total_items,
  );
  const canGoPrevious =
    previousCursor !== null &&
    canNavigatePage(pagination.page, pagination.total_pages, "previous");
  const canGoNext =
    nextCursor !== null &&
    canNavigatePage(pagination.page, pagination.total_pages, "next");

  return (
    <div className={`${listClassName} overflow-visible!`}>
      <div className="relative z-20 flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 px-4 py-3">
        <p className="text-sm text-stone-500">
          <T
            k="common.showing"
            values={{
              start: rangeStart,
              end: rangeEnd,
              total: pagination.total_items,
            }}
          />
        </p>
        <label className="flex items-center gap-2 text-sm text-stone-500">
          <T k="characters.roleFilter" />
          <Select
            value={roleId ?? ""}
            onValueChange={handleRoleChange}
            wrapperClassName="min-w-36"
            className="py-2"
            options={[
              { value: "", label: "All" },
              ...roles.map((role) => ({ value: role.id, label: role.name })),
            ]}
          />
        </label>
        <form
          className="flex min-w-56 flex-1 items-center gap-2 sm:max-w-xs"
          onSubmit={(event) => {
            event.preventDefault();
            const input = new FormData(event.currentTarget).get("q");
            resetWith({ q: typeof input === "string" ? input.trim() : null });
          }}>
          <input
            name="q"
            defaultValue={search}
            placeholder="Search name…"
            className={`${inputClassName} py-2`}
          />
        </form>
        <div className="flex items-center gap-2 text-sm text-stone-500">
          <span>Sort</span>
          <Select
            value={sort}
            onValueChange={(value) => resetWith({ sort: value })}
            wrapperClassName="min-w-32"
            className="py-2"
            options={[
              { value: "name", label: "Name" },
              { value: "updated_at", label: "Updated at" },
              { value: "role", label: "Role" },
            ]}
          />
          <button
            type="button"
            onClick={() =>
              resetWith({ direction: direction === "asc" ? "desc" : "asc" })
            }
            className={secondaryButtonClassName}
            aria-label={direction === "asc" ? "Sort descending" : "Sort ascending"}>
            {direction === "asc" ? "↑" : "↓"}
          </button>
        </div>
      </div>

      <ul className="divide-y divide-stone-200">
        {characters.length === 0 ? (
          <li className="px-4 py-8 text-center text-sm text-stone-500">
            <T k="characters.noCharacters" />
          </li>
        ) : characters.map((char) => (
          <li key={char.id}>
            <Link
              href={`/novels/${novelId}/characters/${char.id}`}
              className={listRowClassName}>
              <div className="flex min-w-0 items-center gap-3">
                <CharacterAvatar char={char} />
                <div className="min-w-0">
                  <span className="block truncate text-sm font-medium text-stone-900">
                    {char.name}
                  </span>
                  {char.aliases.length > 0 ? (
                    <span className="mt-1 block truncate text-xs text-stone-500">
                      {char.aliases.join(", ")}
                    </span>
                  ) : null}
                  <span className="mt-1 block truncate text-xs text-stone-400">
                    <T k="common.updated" />:{" "}
                    <LocalizedDate value={char.updated_at} />
                  </span>
                </div>
              </div>
              <div className="flex w-full items-center justify-between gap-3 sm:w-auto sm:justify-end">
                <span
                  className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${roleColorClassNames[char.role] ?? roleColorClassNames.minor}`}>
                  {char.role_name ?? char.role}
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-200 px-4 py-3">
        <p className="text-sm text-stone-500">
          <T
            k="common.pageOf"
            values={{ page: pagination.page, total: pagination.total_pages }}
          />
        </p>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <label className="flex items-center gap-2 text-sm text-stone-500">
            <T k="common.perPage" />
            <Select
              value={String(pagination.per_page)}
              onValueChange={(value) => handlePerPageChange(Number(value))}
              wrapperClassName="min-w-20"
              className="py-2"
              options={[5, 10, 20, 50].map((size) => ({
                value: String(size),
                label: String(size),
              }))}
            />
          </label>
          <button
            type="button"
            disabled={!canGoPrevious}
            onClick={() => {
              if (!previousCursor) return;
              router.push(
                `${pathname}?${buildCursorPageSearch(searchParams.toString(), {
                  page: Math.max(1, pagination.page - 1),
                  perPage: pagination.per_page,
                  cursor: { name: "before", value: previousCursor },
                })}`,
              );
            }}
            className={secondaryButtonClassName}>
            <T k="common.previous" />
          </button>
          <button
            type="button"
            disabled={!canGoNext}
            onClick={() => {
              if (!nextCursor) return;
              router.push(
                `${pathname}?${buildCursorPageSearch(searchParams.toString(), {
                  page: Math.min(pagination.total_pages, pagination.page + 1),
                  perPage: pagination.per_page,
                  cursor: { name: "after", value: nextCursor },
                })}`,
              );
            }}
            className={secondaryButtonClassName}>
            <T k="common.next" />
          </button>
        </div>
      </div>
    </div>
  );
}

function CharacterAvatar({ char }: { char: Character }) {
  const [failed, setFailed] = useState(false);

  if (char.profile_image_url && !failed) {
    return (
      <Image
        src={char.profile_image_url}
        alt={char.name}
        width={44}
        height={44}
        onError={() => setFailed(true)}
        className="h-11 w-11 shrink-0 rounded-2xl object-cover"
        unoptimized
      />
    );
  }

  return (
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-stone-900 text-sm font-semibold text-stone-50">
      {char.name.slice(0, 2).toUpperCase()}
    </div>
  );
}
