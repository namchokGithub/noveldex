import { notFound } from "next/navigation";
import Link from "next/link";
import { getEntity } from "@/libs/api";
import { DashboardPage, backLinkClassName } from "../../../ui";
import EntityDetail from "./EntityDetail";

export default async function EntityPage({ params }: { params: Promise<{ id: string; entityId: string }> }) {
  const { id, entityId } = await params;
  let entity: Awaited<ReturnType<typeof getEntity>>;
  try { entity = await getEntity(id, entityId); } catch { notFound(); }
  return <DashboardPage maxWidth="max-w-4xl"><div className="space-y-5"><Link href={`/novels/${id}/entities`} className={backLinkClassName}>← Entities</Link><EntityDetail novelId={id} entity={entity} /></div></DashboardPage>;
}
