import Link from "next/link";
import { notFound } from "next/navigation";
import AddCharacterForm from "./AddCharacterForm";
import CharacterList from "./CharacterList";
import { T } from "@/components/i18n/I18nProvider";
import {
  backLinkClassName,
  DashboardPage,
  SectionHeading,
} from "../../ui";
import { getCharacters, getCharacterRoles, getNovel } from "@/libs/api";

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
  searchParams: Promise<{ page?: string; per_page?: string }>;
}) {
  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  const page = parsePositiveInt(resolvedSearchParams.page, 1);
  const requestedPerPage = parsePositiveInt(resolvedSearchParams.per_page, 10);
  const perPage = ALLOWED_PAGE_SIZES.has(requestedPerPage)
    ? requestedPerPage
    : 10;

  let novel: Awaited<ReturnType<typeof getNovel>>;
  let characters: Awaited<ReturnType<typeof getCharacters>>;
  let roles: Awaited<ReturnType<typeof getCharacterRoles>>;

  try {
    [novel, characters, roles] = await Promise.all([
      getNovel(id),
      getCharacters(id, { page, perPage }),
      getCharacterRoles(),
    ]);
  } catch {
    notFound();
  }

  return (
    <DashboardPage maxWidth="max-w-5xl">
      <div className="space-y-5">
        <Link href={`/novels/${id}`} className={backLinkClassName}>
          ← {novel.title}
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
        />
      </div>
    </DashboardPage>
  );
}
