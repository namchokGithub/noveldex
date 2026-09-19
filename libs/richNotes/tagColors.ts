import type { EntityType } from "@/libs/entities/types";

export const TAG_COLORS = {
  character: { color: "#0369A1", hover: "#0C4A6E", underline: "#BAE6FD" },
  location: { color: "#047857", hover: "#065F46", underline: "#A7F3D0" },
  skill: { color: "#7C3AED", hover: "#5B21B6", underline: "#DDD6FE" },
  organization: { color: "#B45309", hover: "#92400E", underline: "#FDE68A" },
  item: { color: "#BE123C", hover: "#9F1239", underline: "#FECDD3" },
  concept: { color: "#C49F0E", hover: "#F2C411", underline: "#B08F0C" },
} as const satisfies Record<EntityType, {
  color: string;
  hover: string;
  underline: string;
}>;

const referenceClassNames: Record<EntityType, string> = {
  character: "font-medium text-[#0369A1] underline decoration-[#BAE6FD] underline-offset-4 hover:text-[#0C4A6E]",
  location: "font-medium text-[#047857] underline decoration-[#A7F3D0] underline-offset-4 hover:text-[#065F46]",
  skill: "font-medium text-[#7C3AED] underline decoration-[#DDD6FE] underline-offset-4 hover:text-[#5B21B6]",
  organization: "font-medium text-[#B45309] underline decoration-[#FDE68A] underline-offset-4 hover:text-[#92400E]",
  item: "font-medium text-[#BE123C] underline decoration-[#FECDD3] underline-offset-4 hover:text-[#9F1239]",
  concept: "font-medium text-[#C49F0E] underline decoration-[#B08F0C] underline-offset-4 hover:text-[#F2C411]",
};

export function entityReferenceClassName(type: EntityType) {
  return referenceClassNames[type];
}
