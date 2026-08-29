import { collection, getDocs, orderBy, query } from "firebase/firestore";
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
  // character_roles is small, global master data (a handful of seeded roles), so we
  // fetch everything ordered by name (served by Firestore's automatic single-field
  // index) and filter is_active in memory. This avoids requiring a composite index
  // for an equality filter + orderBy on a different field, which is never
  // auto-created outside the local emulator and would take down the whole
  // characters domain with FAILED_PRECONDITION on a real Firebase project.
  const snapshot = await getDocs(query(collection(db, "character_roles"), orderBy("name")));
  return snapshot.docs
    .map((d) => toCharacterRole(d.id, d.data() as CharacterRoleDoc))
    .filter((role) => role.is_active);
}
