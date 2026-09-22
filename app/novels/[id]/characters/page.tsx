import Link from "next/link";
import { notFound } from "next/navigation";
import AddCharacterForm from "./AddCharacterForm";
import CharacterList from "./CharacterList";
import { T } from "@/components/i18n/I18nProvider";
import { backLinkClassName, DashboardPage, SectionHeading } from "../../ui";
import {
  encodeCharacterCursor,
  getCharactersPage,
  getCharacterRoles,
  resolveCharacterCursorSearch,
} from "@/libs/api";
import { ResourceNotFoundError } from "@/libs/errors";
import { normalizeCursorPage } from "@/libs/pagination";

const ALLOWED_PAGE_SIZES = new Set([5, 10, 20, 50]);

function parsePositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export default async function CharactersPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    page?: string;
    per_page?: string;
    after?: string;
    before?: string;
  }>;
}) {
  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  const requestedPerPage = parsePositiveInt(resolvedSearchParams.per_page, 10);
  const perPage = ALLOWED_PAGE_SIZES.has(requestedPerPage)
    ? requestedPerPage
    : 10;
  const { after, before } = resolveCharacterCursorSearch(resolvedSearchParams);
  const page = normalizeCursorPage(
    parsePositiveInt(resolvedSearchParams.page, 1),
    Boolean(after || before),
  );

  let characters: Awaited<ReturnType<typeof getCharactersPage>>;
  let roles: Awaited<ReturnType<typeof getCharacterRoles>>;

  try {
    [characters, roles] = await Promise.all([
      getCharactersPage(id, { page, perPage, after, before }),
      getCharacterRoles(),
    ]);
  } catch (error) {
    if (error instanceof ResourceNotFoundError) notFound();
    throw error;
  }

  return (
    <DashboardPage maxWidth="w-full max-w-6xl">
      <div className="space-y-5">
        <Link href={`/novels/${id}`} className={backLinkClassName}>
          ← {characters.novel.title}
        </Link>

        <SectionHeading
          eyebrow={<T k="characters.eyebrow" />}
          title={<T k="characters.directoryTitle" />}
          description={<T k="characters.directoryDescription" />}
          action={<AddCharacterForm novelId={id} roles={roles} />}
        />

        <CharacterList
          novelId={id}
          characters={characters.items}
          pagination={characters.pagination}
          previousCursor={
            characters.previousCursor
              ? encodeCharacterCursor(characters.previousCursor)
              : null
          }
          nextCursor={
            characters.nextCursor
              ? encodeCharacterCursor(characters.nextCursor)
              : null
          }
        />
      </div>
    </DashboardPage>
  );
}
