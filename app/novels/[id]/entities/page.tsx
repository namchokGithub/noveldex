import Link from "next/link";
import { notFound } from "next/navigation";
import { getEntities, getNovel } from "@/libs/api";
import { DashboardPage, SectionHeading, backLinkClassName } from "../../ui";
import EntityList from "./EntityList";
import { T } from "@/components/i18n/I18nProvider";

export default async function EntitiesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let data: Awaited<ReturnType<typeof getNovel>>;
  let entities: Awaited<ReturnType<typeof getEntities>>;
  try {
    [data, entities] = await Promise.all([getNovel(id), getEntities(id)]);
  } catch {
    notFound();
  }
  return (
    <DashboardPage maxWidth="max-w-5xl">
      <div className="space-y-5">
        <Link href={`/novels/${id}`} className={backLinkClassName}>
          ← {data.title}
        </Link>
        <SectionHeading
          eyebrow={<T k="entities.eyebrow" />}
          title={<T k="entities.title" />}
          description={<T k="entities.description" />}
        />
        <EntityList novelId={id} entities={entities} />
      </div>
    </DashboardPage>
  );
}
