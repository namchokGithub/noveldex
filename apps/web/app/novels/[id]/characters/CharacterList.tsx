"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import type { Character, PaginationMeta } from "@/app/types";
import {
  inputClassName,
  listClassName,
  listRowClassName,
  roleColorClassNames,
  secondaryButtonClassName,
} from "../../ui";
import { T } from "@/components/i18n/I18nProvider";
import { useRouter } from "next/navigation";

export default function CharacterList({
  novelId,
  characters,
  pagination,
}: {
  novelId: string;
  characters: Character[];
  pagination: PaginationMeta;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function buildPageHref(page: number, perPage = pagination.per_page) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(page));
    params.set("per_page", String(perPage));
    return `${pathname}?${params.toString()}`;
  }

  function handlePerPageChange(nextPerPage: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", "1");
    params.set("per_page", String(nextPerPage));
    router.push(`${pathname}?${params.toString()}`);
  }

  if (characters.length === 0 && pagination.page === 1) {
    return (
      <div className="flex min-h-65 items-center justify-center rounded-[22px] border border-dashed border-stone-300 bg-white/70 px-6 py-12 text-center text-sm text-stone-500 shadow-sm">
        <T k="characters.noCharacters" />
      </div>
    );
  }

  const rangeStart = (pagination.page - 1) * pagination.per_page + 1;
  const rangeEnd = Math.min(
    pagination.page * pagination.per_page,
    pagination.total_items,
  );

  return (
    <div className={listClassName}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 px-4 py-3">
        <p className="text-sm text-stone-500">
          Showing {rangeStart}–{rangeEnd} of {pagination.total_items}
        </p>
        <label className="flex items-center gap-2 text-sm text-stone-500">
          Per page
          <select
            value={pagination.per_page}
            onChange={(e) => handlePerPageChange(Number(e.target.value))}
            className={`${inputClassName} min-w-20 py-2`}>
            {[5, 10, 20, 50].map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
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
              <div className="flex items-center gap-3">
                <span
                  className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${roleColorClassNames[char.role] ?? roleColorClassNames.minor}`}>
                  {char.role_name ?? char.role}
                </span>
                <span className="text-xs text-stone-500">
                  <T
                    k={
                      char.chapter_count === 1
                        ? "characters.chapter.one"
                        : "characters.chapter.other"
                    }
                    values={{ count: char.chapter_count }}
                  />
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-200 px-4 py-3">
        <p className="text-sm text-stone-500">
          Page {pagination.page} of {pagination.total_pages}
        </p>
        <div className="flex items-center gap-2">
          <Link
            href={buildPageHref(Math.max(1, pagination.page - 1))}
            prefetch={false}
            aria-disabled={pagination.page <= 1}
            className={`${secondaryButtonClassName} ${
              pagination.page <= 1 ? "pointer-events-none opacity-50" : ""
            }`}>
            Prev
          </Link>
          <Link
            href={buildPageHref(
              Math.min(pagination.total_pages, pagination.page + 1),
            )}
            prefetch={false}
            aria-disabled={pagination.page >= pagination.total_pages}
            className={`${secondaryButtonClassName} ${
              pagination.page >= pagination.total_pages
                ? "pointer-events-none opacity-50"
                : ""
            }`}>
            Next
          </Link>
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
