import { getAllCharacters } from "@/libs/firebase/characters";
import { getEntities } from "@/libs/firebase/entities";
import { buildEntityId } from "./keys";
import type { EntityLookup } from "./references";
import type { Entity, EntityType } from "./types";

const normalize = (value: string) => value.normalize("NFC").trim().toLocaleLowerCase();

export function firestoreEntityLookup(): EntityLookup {
  // A note's content can carry several [[mentions]], and resolving each one
  // calls findByName separately. Cache each (novelId, type) collection read
  // for the lifetime of this lookup instance so N mentions of the same type
  // cost one Firestore read instead of N.
  const entitiesByTypeCache = new Map<string, Promise<Entity[]>>();
  function entitiesOfType(novelId: string, type: EntityType): Promise<Entity[]> {
    const key = `${novelId}:${type}`;
    let pending = entitiesByTypeCache.get(key);
    if (!pending) {
      pending = type === "character"
        ? getAllCharacters(novelId).then((characters) => characters.map((character) => ({
            id: buildEntityId(novelId, "character", character.id), novelId, type: "character" as const, name: character.name,
            aliases: character.aliases, description: character.description,
          })))
        : getEntities(novelId, type);
      entitiesByTypeCache.set(key, pending);
    }
    return pending;
  }

  return {
    async findByName(novelId: string, name: string, type: EntityType): Promise<Entity[]> {
      const needle = normalize(name);
      const entities = await entitiesOfType(novelId, type);
      return entities.filter((entity) => normalize(entity.name) === needle || entity.aliases.some((alias) => normalize(alias) === needle));
    },
  };
}
