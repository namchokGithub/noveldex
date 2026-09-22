"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import type { Character, PaginationMeta } from "@/app/types";
import {
  emptyStateClassName,
  listClassName,
  listRowClassName,
  roleColorClassNames,
  secondaryButtonClassName,
} from "../../ui";
import { T } from "@/components/i18n/I18nProvider";
import { useRouter } from "next/navigation";
import { buildCursorPageSearch, canNavigatePage } from "@/libs/pagination";
import { Select } from "@/components/ui/Select";

export default function CharacterList({
  novelId,
  characters,
  pagination,
  previousCursor,
  nextCursor,
}: {
  novelId: string;
  characters: Character[];
  pagination: PaginationMeta;
  previousCursor: string | null;
  nextCursor: string | null;
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

  if (characters.length === 0 && pagination.page === 1) {
    return (
      <div className={emptyStateClassName}>
        <T k="characters.noCharacters" />
      </div>
    );
  }

  const rangeStart = (pagination.page - 1) * pagination.per_page + 1;
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
    <div className={listClassName}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 px-4 py-3">
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
      </div>

      <ul className="divide-y divide-stone-200">
        {characters.map((char) => (
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
        <div className="flex items-center gap-2">
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
