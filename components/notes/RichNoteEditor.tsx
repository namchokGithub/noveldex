"use client";

import { Node } from "@tiptap/core";
import Highlight from "@tiptap/extension-highlight";
import Link from "@tiptap/extension-link";
import StarterKit from "@tiptap/starter-kit";
import Suggestion, { type SuggestionProps } from "@tiptap/suggestion";
import { EditorContent, useEditor } from "@tiptap/react";
import { useEffect, useMemo } from "react";
import type { Entity, EntityType } from "@/libs/entities/types";
import { createRichNoteDocument, richNoteDocumentToText, type RichNoteDocument } from "@/libs/richNotes/document";

function entitySyntax(type: EntityType, label: string) {
  return type === "character" ? `[[${label}]]` : `[[${type}:${label}]]`;
}

function matchingEntities(entities: Entity[], query: string) {
  const [prefix, ...rest] = query.split(":");
  const entityTypes: EntityType[] = ["character", "location", "skill", "organization", "item", "concept"];
  const type = entityTypes.includes(prefix as EntityType) ? (prefix as EntityType) : undefined;
  const search = (type ? rest.join(":") : query).trim().toLocaleLowerCase();
  return entities.filter((entity) => (!type || entity.type === type) && (!search || [entity.name, ...entity.aliases].some((value) => value.toLocaleLowerCase().includes(search)))).slice(0, 8);
}

function renderEntityMenu() {
  let element: HTMLDivElement | null = null;
  let unmount: (() => void) | undefined;
  let selectedIndex = 0;
  let latest: SuggestionProps<Entity, Entity> | null = null;
  const choose = (index: number) => { const item = latest?.items[index]; if (item) latest?.command(item); };
  const paint = (props: SuggestionProps<Entity, Entity>) => {
    if (!element) return;
    element.replaceChildren(...props.items.map((entity, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = entitySyntax(entity.type, entity.name);
      button.className = `block w-full px-3 py-2 text-left text-sm ${index === selectedIndex ? "bg-stone-100" : "hover:bg-stone-50"}`;
      button.onmousedown = (event) => { event.preventDefault(); choose(index); };
      return button;
    }));
    element.hidden = props.items.length === 0;
  };
  return {
    onStart(props: SuggestionProps<Entity, Entity>) {
      latest = props; selectedIndex = 0;
      element = document.createElement("div");
      element.className = "z-50 max-h-56 min-w-52 overflow-y-auto rounded-xl border border-stone-200 bg-white py-1 shadow-lg";
      paint(props); unmount = props.mount(element);
    },
    onUpdate(props: SuggestionProps<Entity, Entity>) { latest = props; selectedIndex = Math.min(selectedIndex, Math.max(props.items.length - 1, 0)); paint(props); },
    onKeyDown({ event }: { event: KeyboardEvent }) {
      if (!latest?.items.length) return false;
      if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); selectedIndex = (selectedIndex + (event.key === "ArrowDown" ? 1 : -1) + latest.items.length) % latest.items.length; paint(latest); return true; }
      if (event.key === "Enter") { event.preventDefault(); choose(selectedIndex); return true; }
      return false;
    },
    onExit() { unmount?.(); element = null; latest = null; },
  };
}

function entityReferenceExtension(entities: Entity[]) {
  return Node.create({
    name: "entityReference", group: "inline", inline: true, atom: true,
    addAttributes() { return { entityType: { default: "character" }, label: { default: "" } }; },
    parseHTML() { return [{ tag: "span[data-entity-reference]" }]; },
    renderHTML({ HTMLAttributes }) {
      const label = String(HTMLAttributes.label ?? "");
      const type = String(HTMLAttributes.entityType ?? "character") as EntityType;
      return ["span", { "data-entity-reference": "", "data-entity-type": type, class: "rounded bg-sky-100 px-1 text-sky-800" }, entitySyntax(type, label)];
    },
    addProseMirrorPlugins() {
      return [Suggestion<Entity, Entity>({ editor: this.editor, char: "[[", allowSpaces: true, allowedPrefixes: null, items: ({ query }) => matchingEntities(entities, query), command: ({ editor, range, props }) => editor.chain().focus().deleteRange(range).insertContent({ type: "entityReference", attrs: { entityType: props.type, label: props.name } }).run(), render: renderEntityMenu })];
    },
  });
}

function useExtensions(entities: Entity[] = []) {
  return useMemo(() => [StarterKit.configure({ heading: { levels: [3] } }), Highlight, Link.configure({ protocols: ["http", "https", "mailto"], openOnClick: false }), entityReferenceExtension(entities)], [entities]);
}

export function RichNoteContent({ content, contentJson }: { content: string; contentJson?: RichNoteDocument }) {
  const extensions = useExtensions();
  const editor = useEditor({ immediatelyRender: false, editable: false, extensions, content: contentJson ?? createRichNoteDocument(content), editorProps: { attributes: { class: "text-sm leading-7 text-stone-700" } } }, [content, contentJson, extensions]);
  return editor ? <EditorContent editor={editor} /> : null;
}

export function RichNoteEditor({ initialContent, initialContentJson, entities, onChange }: { initialContent: string; initialContentJson?: RichNoteDocument; entities: Entity[]; onChange: (value: { content: string; contentJson: RichNoteDocument }) => void; }) {
  const extensions = useExtensions(entities);
  const editor = useEditor({ immediatelyRender: false, extensions, content: initialContentJson ?? createRichNoteDocument(initialContent), editorProps: { attributes: { class: "min-h-32 px-3.5 py-2.5 outline-none" } }, onUpdate: ({ editor }) => { const contentJson = editor.getJSON() as RichNoteDocument; onChange({ content: richNoteDocumentToText(contentJson), contentJson }); } }, [extensions]);
  useEffect(() => { if (editor) editor.commands.setContent(initialContentJson ?? createRichNoteDocument(initialContent), { emitUpdate: false }); }, [editor, initialContent, initialContentJson]);
  if (!editor) return null;
  const insertEntity = (entity: Entity) => editor.chain().focus().insertContent({ type: "entityReference", attrs: { entityType: entity.type, label: entity.name } }).run();
  const button = (label: string, action: () => void, active = false) => <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={action} className={`rounded px-2 py-1 text-xs ${active ? "bg-stone-900 text-white" : "hover:bg-stone-100"}`}>{label}</button>;
  const setLink = () => { const href = window.prompt("URL")?.trim(); if (href && /^(https?:|mailto:)/i.test(href)) editor.chain().focus().setLink({ href }).run(); };
  return <div className="rounded-2xl border border-stone-200 bg-white shadow-sm"><div className="flex flex-wrap gap-1 border-b border-stone-200 p-2">
    {button("B", () => editor.chain().focus().toggleBold().run(), editor.isActive("bold"))}{button("I", () => editor.chain().focus().toggleItalic().run(), editor.isActive("italic"))}{button("S", () => editor.chain().focus().toggleStrike().run(), editor.isActive("strike"))}{button("Highlight", () => editor.chain().focus().toggleHighlight().run(), editor.isActive("highlight"))}{button("P", () => editor.chain().focus().setParagraph().run())}{button("H3", () => editor.chain().focus().toggleHeading({ level: 3 }).run(), editor.isActive("heading", { level: 3 }))}{button("• List", () => editor.chain().focus().toggleBulletList().run(), editor.isActive("bulletList"))}{button("1. List", () => editor.chain().focus().toggleOrderedList().run(), editor.isActive("orderedList"))}{button("Quote", () => editor.chain().focus().toggleBlockquote().run(), editor.isActive("blockquote"))}{button("Link", setLink)}{button("Unlink", () => editor.chain().focus().unsetLink().run())}{button("Undo", () => editor.chain().focus().undo().run())}{button("Redo", () => editor.chain().focus().redo().run())}{button("Clear", () => editor.chain().focus().unsetAllMarks().clearNodes().run())}
  </div><div className="border-b border-stone-200 p-2"><select aria-label="Insert entity reference" defaultValue="" onChange={(event) => { const entity = entities.find((item) => item.id === event.target.value); if (entity) insertEntity(entity); event.currentTarget.value = ""; }} className="max-w-full rounded border border-stone-200 px-2 py-1 text-xs"><option value="">Entity reference…</option>{entities.map((entity) => <option key={entity.id} value={entity.id}>{entity.type}: {entity.name}</option>)}</select></div><EditorContent editor={editor} /></div>;
}
