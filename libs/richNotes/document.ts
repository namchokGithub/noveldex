import type { EntityType } from "@/libs/entities/types";

export interface RichNoteNode {
  type: string;
  text?: string;
  attrs?: {
    entityType?: EntityType;
    label?: string;
  };
  content?: RichNoteNode[];
  marks?: Array<{ type: string }>;
}

export interface RichNoteDocument {
  type: "doc";
  content: RichNoteNode[];
}

export function createRichNoteDocument(content: string): RichNoteDocument {
  return {
    type: "doc",
    content: content.split(/\n{2,}/).map((paragraph) => ({
      type: "paragraph",
      ...(paragraph ? { content: [{ type: "text", text: paragraph }] } : {}),
    })),
  };
}

function textFromNode(node: RichNoteNode): string {
  if (node.type === "text") return node.text ?? "";
  if (node.type === "entityReference") {
    const label = node.attrs?.label ?? "";
    if (!label) return "";
    return node.attrs?.entityType === "character"
      ? `[[${label}]]`
      : `[[${node.attrs?.entityType}:${label}]]`;
  }
  return (node.content ?? []).map(textFromNode).join("");
}

function collectBlocks(node: RichNoteNode, blocks: string[]) {
  if (["paragraph", "heading", "blockquote"].includes(node.type)) {
    blocks.push(textFromNode(node));
    return;
  }
  (node.content ?? []).forEach((child) => collectBlocks(child, blocks));
}

export function richNoteDocumentToText(document: RichNoteDocument): string {
  const blocks: string[] = [];
  document.content.forEach((node) => collectBlocks(node, blocks));
  return blocks.join("\n");
}
