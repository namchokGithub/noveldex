import { collection, getDocs, orderBy, query, where } from "firebase/firestore";
import type { CharacterRole } from "@/app/types";
import { db } from "./app";

interface CharacterRoleDoc {
  code: string;
  name: string;
  is_active: boolean;
}

function toCharacterRole(id: string, data: CharacterRoleDoc): CharacterRole {
  return { id, code: data.code, name: data.name, is_active: data.is_active };
}

export async function getCharacterRoles(): Promise<CharacterRole[]> {
  const snapshot = await getDocs(
    query(
      collection(db, "character_roles"),
      where("is_active", "==", true),
      orderBy("name"),
    ),
  );
  return snapshot.docs.map((d) => toCharacterRole(d.id, d.data() as CharacterRoleDoc));
}
