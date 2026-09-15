import Link from "next/link";
import { notFound } from "next/navigation";
import AdaptationNotesEditor from "../../../../../adaptations/AdaptationNotesEditor";
import BackToTopButton from "@/app/novels/BackToTopButton";
import { T } from "@/components/i18n/I18nProvider";
import {
  backLinkClassName,
  DashboardPage,
  SectionHeading,
} from "@/app/novels/ui";
import { getAdaptation, getAllCharacters, getNovel } from "@/libs/api";
import { ResourceNotFoundError } from "@/libs/errors";

export default async function AdaptationNotesPage({
  params,
}: {
  params: Promise<{ id: string; volumeId: string; adaptationId: string }>;
}) {
  const { id, volumeId, adaptationId } = await params;
  let novel: Awaited<ReturnType<typeof getNovel>>;
  let adaptation: Awaited<ReturnType<typeof getAdaptation>>;
  let characters: Awaited<ReturnType<typeof getAllCharacters>>;
  try {
    [novel, adaptation, characters] = await Promise.all([
      getNovel(id),
      getAdaptation(id, volumeId, adaptationId),
      getAllCharacters(id),
    ]);
  } catch (error) {
    if (error instanceof ResourceNotFoundError) notFound();
    throw error;
  }
  return (
    <DashboardPage maxWidth="w-full max-w-4xl">
      <div className="space-y-5">
        <Link
          id="adaptation-notes-back-link"
          href={`/novels/${id}/adaptations#adaptation-${adaptationId}`}
          className={backLinkClassName}>
          ← {novel.title}
        </Link>
        <SectionHeading
          eyebrow={<T k="adaptations.title" />}
          title={adaptation.title}
          description={<T k="adaptations.notes" />}
        />
        <AdaptationNotesEditor adaptation={adaptation} characters={characters} />
        <BackToTopButton anchorId="adaptation-notes-back-link" />
      </div>
    </DashboardPage>
  );
}
