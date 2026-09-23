import Link from "next/link";
import { notFound } from "next/navigation";
import CharacterDetail from "./CharacterDetail";
import { backLinkClassName, DashboardPage } from "../../../ui";
import { T } from "@/components/i18n/I18nProvider";
import {
  getAdaptationsForNovel,
  getCharacter,
  getCharacterRoles,
  getEventsForCharacter,
  getNovel,
} from "@/libs/api";
import { adaptationsForCharacter } from "@/libs/characterCrossReferences";
import { ResourceNotFoundError } from "@/libs/errors";
import BackToTopButton from "@/app/novels/BackToTopButton";

export default async function CharacterPage({
  params,
}: {
  params: Promise<{ id: string; characterId: string }>;
}) {
  const { id, characterId } = await params;

  let character: Awaited<ReturnType<typeof getCharacter>>;
  let roles: Awaited<ReturnType<typeof getCharacterRoles>>;
  let events: Awaited<ReturnType<typeof getEventsForCharacter>>;
  let adaptations: Awaited<ReturnType<typeof getAdaptationsForNovel>>;

  try {
    // getNovel is fetched (and awaited) solely to 404 when the parent novel is gone.
    [, character, roles, events, adaptations] = await Promise.all([
      getNovel(id),
      getCharacter(id, characterId),
      getCharacterRoles(),
      getEventsForCharacter(id, characterId),
      getAdaptationsForNovel(id),
    ]);
  } catch (error) {
    if (error instanceof ResourceNotFoundError) notFound();
    throw error;
  }

  return (
    <DashboardPage maxWidth="w-full max-w-6xl">
      <div className="space-y-5">
        <Link
          id="character-detail-back-link"
          href={`/novels/${id}/characters`}
          className={backLinkClassName}>
          ← <T k="nav.characters" />
        </Link>

        <CharacterDetail
          character={character}
          novelId={id}
          roles={roles}
          events={events}
          adaptations={adaptationsForCharacter(
            adaptations,
            character.id,
            new Set(character.chapters?.map((chapter) => chapter.id) ?? []),
          )}
        />
        <BackToTopButton anchorId="character-detail-back-link" />
      </div>
    </DashboardPage>
  );
}
