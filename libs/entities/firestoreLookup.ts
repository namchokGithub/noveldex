import { getAllCharacters } from "@/libs/firebase/characters";
import { getEntities } from "@/libs/firebase/entities";
import { buildEntityId } from "./keys";
import type { EntityLookup } from "./references";
import type { Entity, EntityType } from "./types";

const normalize = (value: string) => value.normalize("NFC").trim().toLocaleLowerCase();

export function firestoreEntityLookup(): EntityLookup {
  // A note's content can carry several [[mentions]], and resolving each one
  // calls findByName separately. Generic entities share one collection, so
  // cache its full novel dataset once and filter it by type in memory.
  const charactersByNovelCache = new Map<string, Promise<Entity[]>>();
  const genericEntitiesByNovelCache = new Map<string, Promise<Entity[]>>();

  function entitiesOfType(novelId: string, type: EntityType): Promise<Entity[]> {
    if (type === "character") {
      let characters = charactersByNovelCache.get(novelId);
      if (!characters) {
        characters = getAllCharacters(novelId).then((items) => items.map((character) => ({
            id: buildEntityId(novelId, "character", character.id), novelId, type: "character" as const, name: character.name,
            aliases: character.aliases, description: character.description,
          })));
        charactersByNovelCache.set(novelId, characters);
      }
      return characters;
    }

    let entities = genericEntitiesByNovelCache.get(novelId);
    if (!entities) {
      entities = getEntities(novelId);
      genericEntitiesByNovelCache.set(novelId, entities);
    }
    return entities.then((items) => items.filter((entity) => entity.type === type));
  }

  return {
    async findByName(novelId: string, name: string, type: EntityType): Promise<Entity[]> {
      const needle = normalize(name);
      const entities = await entitiesOfType(novelId, type);
      return entities.filter((entity) => normalize(entity.name) === needle || entity.aliases.some((alias) => normalize(alias) === needle));
    },
  };
}
