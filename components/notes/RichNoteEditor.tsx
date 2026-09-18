"use client";

import { Node } from "@tiptap/core";
import Highlight from "@tiptap/extension-highlight";
import Link from "@tiptap/extension-link";
import StarterKit from "@tiptap/starter-kit";
import Suggestion, { type SuggestionProps } from "@tiptap/suggestion";
import { EditorContent, useEditor } from "@tiptap/react";
import { Bold, Eraser, Heading3, Highlighter, Italic, Link2, Link2Off, List, ListOrdered, Pilcrow, Quote, Redo2, Strikethrough, Undo2 } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";
import ModalDialog from "@/components/a11y/ModalDialog";
import { inputClassName, modalPanelClassName, primaryButtonClassName, secondaryButtonClassName } from "@/app/novels/ui";
import type { Entity, EntityType } from "@/libs/entities/types";
import { createRichNoteDocument, richNoteDocumentToText, type RichNoteDocument } from "@/libs/richNotes/document";

const richNoteContentClassName = "text-sm leading-7 text-stone-700 [&_p]:my-2 [&_h3]:my-4 [&_h3]:text-lg [&_h3]:font-semibold [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1 [&_blockquote]:my-3 [&_blockquote]:border-l-4 [&_blockquote]:border-stone-300 [&_blockquote]:pl-4 [&_blockquote]:italic [&_a]:text-sky-700 [&_a]:underline";

const icons = {
  undo: <Undo2 />, redo: <Redo2 />, bold: <Bold />, italic: <Italic />,
  strike: <Strikethrough />, highlight: <Highlighter />, paragraph: <Pilcrow />,
  heading: <Heading3 />, bulletList: <List />, orderedList: <ListOrdered />,
  quote: <Quote />, link: <Link2 />, unlink: <Link2Off />, clear: <Eraser />,
};

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

const viewerExtensions = [
  StarterKit.configure({ heading: { levels: [3] }, link: false }),
  Highlight,
  Link.configure({ openOnClick: false }),
  entityReferenceExtension([]),
];

function editorExtensions(entities: Entity[]) {
  return [
    StarterKit.configure({ heading: { levels: [3] }, link: false }),
    Highlight,
    Link.configure({ openOnClick: false }),
    entityReferenceExtension(entities),
  ];
}

export function RichNoteContent({ content, contentJson }: { content: string; contentJson?: RichNoteDocument }) {
  const editor = useEditor({ immediatelyRender: false, editable: false, extensions: viewerExtensions, content: contentJson ?? createRichNoteDocument(content), editorProps: { attributes: { class: richNoteContentClassName } } }, []);
  useEffect(() => {
    editor?.commands.setContent(contentJson ?? createRichNoteDocument(content), { emitUpdate: false });
  }, [editor, content, contentJson]);
  return editor ? <EditorContent editor={editor} /> : null;
}

export function RichNoteEditor({ initialContent, initialContentJson, entities, onChange }: { initialContent: string; initialContentJson?: RichNoteDocument; entities: Entity[]; onChange: (value: { content: string; contentJson: RichNoteDocument }) => void; }) {
  const [extensions] = useState(() => editorExtensions(entities));
  const [initialDocument] = useState(() => initialContentJson ?? createRichNoteDocument(initialContent));
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const editor = useEditor({ immediatelyRender: false, extensions, content: initialDocument, editorProps: { attributes: { class: `min-h-32 px-3.5 py-2.5 outline-none ${richNoteContentClassName}` } }, onUpdate: ({ editor }) => { const contentJson = editor.getJSON() as RichNoteDocument; onChangeRef.current({ content: richNoteDocumentToText(contentJson), contentJson }); } }, [extensions]);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkHref, setLinkHref] = useState("");
  const [linkError, setLinkError] = useState("");
  const linkDialogTitleId = useId();
  if (!editor) return null;
  const insertEntity = (entity: Entity) => editor.chain().focus().insertContent({ type: "entityReference", attrs: { entityType: entity.type, label: entity.name } }).run();
  const button = (label: string, icon: ReactNode, action: () => void, active = false) => (
    <button type="button" title={label} aria-label={label} onMouseDown={(event) => event.preventDefault()} onClick={action} className={`grid size-8 place-items-center rounded text-stone-700 transition [&_svg]:size-4 ${active ? "bg-stone-900 text-white" : "hover:bg-stone-100"}`}>{icon}</button>
  );
  const openLinkDialog = () => {
    setLinkHref(editor.getAttributes("link").href ?? "");
    setLinkError("");
    setLinkDialogOpen(true);
  };
  const setLink = () => {
    const href = linkHref.trim();
    if (!/^(https?:|mailto:)/i.test(href)) {
      setLinkError("Use an http://, https://, or mailto: URL.");
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
    setLinkDialogOpen(false);
  };
  return <div className="rounded-2xl border border-stone-200 bg-white shadow-sm">
    <div className="flex flex-wrap items-center gap-1 border-b border-stone-200 p-2">
      <div className="flex gap-0.5 border-r border-stone-200 pr-2">{button("Undo", icons.undo, () => editor.chain().focus().undo().run())}{button("Redo", icons.redo, () => editor.chain().focus().redo().run())}</div>
      <div className="flex gap-0.5 border-r border-stone-200 pr-2">{button("Bold", icons.bold, () => editor.chain().focus().toggleBold().run(), editor.isActive("bold"))}{button("Italic", icons.italic, () => editor.chain().focus().toggleItalic().run(), editor.isActive("italic"))}{button("Strikethrough", icons.strike, () => editor.chain().focus().toggleStrike().run(), editor.isActive("strike"))}{button("Highlight", icons.highlight, () => editor.chain().focus().toggleHighlight().run(), editor.isActive("highlight"))}</div>
      <div className="flex gap-0.5 border-r border-stone-200 pr-2">{button("Paragraph", icons.paragraph, () => editor.chain().focus().setParagraph().run())}{button("Heading 3", icons.heading, () => editor.chain().focus().toggleHeading({ level: 3 }).run(), editor.isActive("heading", { level: 3 }))}{button("Bullet list", icons.bulletList, () => editor.chain().focus().toggleBulletList().run(), editor.isActive("bulletList"))}{button("Ordered list", icons.orderedList, () => editor.chain().focus().toggleOrderedList().run(), editor.isActive("orderedList"))}{button("Quote", icons.quote, () => editor.chain().focus().toggleBlockquote().run(), editor.isActive("blockquote"))}</div>
      <div className="flex gap-0.5">{button("Add link", icons.link, openLinkDialog, editor.isActive("link"))}{button("Remove link", icons.unlink, () => editor.chain().focus().unsetLink().run())}{button("Clear formatting", icons.clear, () => editor.chain().focus().unsetAllMarks().clearNodes().run())}</div>
    </div>
    <div className="border-b border-stone-200 p-2"><select aria-label="Insert entity reference" defaultValue="" onChange={(event) => { const entity = entities.find((item) => item.id === event.target.value); if (entity) insertEntity(entity); event.currentTarget.value = ""; }} className="max-w-full rounded border border-stone-200 bg-white px-2 py-1.5 text-xs"><option value="">[[ Entity reference ]]</option>{entities.map((entity) => <option key={entity.id} value={entity.id}>{entity.type}: {entity.name}</option>)}</select></div>
    <EditorContent editor={editor} />
    <ModalDialog open={linkDialogOpen} onClose={() => setLinkDialogOpen(false)} labelledBy={linkDialogTitleId} className={`${modalPanelClassName} max-w-sm`}>
      <form onSubmit={(event) => { event.preventDefault(); setLink(); }}>
        <h3 id={linkDialogTitleId} className="text-lg font-semibold tracking-[-0.03em] text-stone-950">Add link</h3>
        <label className="mt-4 block text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">URL
          <input autoFocus value={linkHref} onChange={(event) => { setLinkHref(event.target.value); setLinkError(""); }} className={`${inputClassName} mt-1 w-full`} placeholder="https://example.com" />
        </label>
        {linkError ? <p className="mt-2 text-sm text-rose-600">{linkError}</p> : null}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={() => setLinkDialogOpen(false)} className={secondaryButtonClassName}>Cancel</button>
          <button type="submit" className={primaryButtonClassName}>Add link</button>
        </div>
      </form>
    </ModalDialog>
  </div>;
}
