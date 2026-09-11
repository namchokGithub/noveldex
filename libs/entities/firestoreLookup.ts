import { getAllCharacters } from "@/libs/firebase/characters";
import { getEntities } from "@/libs/firebase/entities";
import { buildEntityId } from "./keys";
import type { EntityLookup } from "./references";
import type { Entity, EntityType } from "./types";

const normalize = (value: string) => value.normalize("NFC").trim().toLocaleLowerCase();

export function firestoreEntityLookup(): EntityLookup {
  return {
    async findByName(novelId: string, name: string, type: EntityType): Promise<Entity[]> {
      const needle = normalize(name);
      const entities: Entity[] = type === "character"
        ? (await getAllCharacters(novelId)).map((character) => ({
            id: buildEntityId(novelId, "character", character.id), novelId, type: "character", name: character.name,
            aliases: character.aliases, description: character.description,
          }))
        : await getEntities(novelId, type);
      return entities.filter((entity) => normalize(entity.name) === needle || entity.aliases.some((alias) => normalize(alias) === needle));
    },
  };
}
