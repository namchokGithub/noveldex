import { notFound } from "next/navigation";
import AdaptationTimeline from "./AdaptationTimeline";
import { getAdaptationsForNovel, getNovel, getVolumesFlat } from "@/libs/api";
import { ResourceNotFoundError } from "@/libs/errors";

export default async function AdaptationsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let novel: Awaited<ReturnType<typeof getNovel>>;
  let volumes: Awaited<ReturnType<typeof getVolumesFlat>>;
  let adaptations: Awaited<ReturnType<typeof getAdaptationsForNovel>>;
  try {
    [novel, volumes, adaptations] = await Promise.all([
      getNovel(id),
      getVolumesFlat(id),
      getAdaptationsForNovel(id),
    ]);
  } catch (error) {
    if (error instanceof ResourceNotFoundError) notFound();
    throw error;
  }
  return (
    <AdaptationTimeline
      novelId={id}
      novelTitle={novel.title}
      volumes={volumes}
      initialAdaptations={adaptations}
    />
  );
}
