"use client";

import { Node } from "@tiptap/core";
import Highlight from "@tiptap/extension-highlight";
import Link from "@tiptap/extension-link";
import StarterKit from "@tiptap/starter-kit";
import Suggestion, { type SuggestionProps } from "@tiptap/suggestion";
import { EditorContent, useEditor } from "@tiptap/react";
import {
  Bold,
  Eraser,
  Heading3,
  Highlighter,
  Italic,
  Link2,
  Link2Off,
  List,
  ListOrdered,
  Pilcrow,
  Quote,
  Redo2,
  Strikethrough,
  Undo2,
} from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { Character } from "@/app/types";
import ModalDialog from "@/components/a11y/ModalDialog";
import {
  inputClassName,
  modalPanelClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
} from "@/app/novels/ui";
import type { Entity, EntityType } from "@/libs/entities/types";
import { genericEntityHref, resolveGenericReference } from "@/libs/richNotes/preview";
import {
  createRichNoteDocument,
  richNoteDocumentToText,
  type RichNoteDocument,
  type RichNoteNode,
} from "@/libs/richNotes/document";

const richNoteContentClassName =
  "text-sm leading-7 text-stone-700 [&_p]:my-2 [&_h3]:my-4 [&_h3]:text-lg [&_h3]:font-semibold [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1 [&_blockquote]:my-3 [&_blockquote]:border-l-4 [&_blockquote]:border-stone-300 [&_blockquote]:pl-4 [&_blockquote]:italic [&_a]:underline";

interface ExternalLinkPreview {
  title: string;
  icon: string | null;
  domain: string;
}
const linkPreviewCache = new Map<string, ExternalLinkPreview>();

const icons = {
  undo: <Undo2 />,
  redo: <Redo2 />,
  bold: <Bold />,
  italic: <Italic />,
  strike: <Strikethrough />,
  highlight: <Highlighter />,
  paragraph: <Pilcrow />,
  heading: <Heading3 />,
  bulletList: <List />,
  orderedList: <ListOrdered />,
  quote: <Quote />,
  link: <Link2 />,
  unlink: <Link2Off />,
  clear: <Eraser />,
};

function entitySyntax(type: EntityType, label: string) {
  return type === "character" ? `[[${label}]]` : `[[${type}:${label}]]`;
}

function previewNode(
  node: RichNoteNode,
  characters: Character[],
  entities: Entity[],
  novelId?: string,
): RichNoteNode[] {
  if (node.type === "entityReference") {
    const character =
      node.attrs?.entityType === "character"
        ? characters.find((item) => item.name === node.attrs?.label)
        : undefined;
    const linkedHref = node.marks?.find((mark) => mark.type === "link")?.attrs
      ?.href;
    const generic =
      node.attrs?.entityType && node.attrs.entityType !== "character"
        ? resolveGenericReference(entities, node.attrs.entityType, node.attrs.label ?? "")
        : null;
    return [
      {
        ...node,
        attrs: {
          ...node.attrs,
          href:
            character && novelId
              ? `/novels/${novelId}/characters/${character.id}`
              : generic && novelId
                ? genericEntityHref(novelId, generic)
                : (linkedHref ?? null),
          linkedKeyword: !character && !generic && Boolean(linkedHref),
        },
      },
    ];
  }
  if (node.type !== "text" || !node.text)
    return [
      {
        ...node,
        content: node.content?.flatMap((child) =>
          previewNode(child, characters, entities, novelId),
        ),
      },
    ];
  const linkedHref = node.marks?.find((mark) => mark.type === "link")?.attrs
    ?.href;
  const parts = node.text.split(/(\[\[[^\]]+\]\])/g);
  return parts.filter(Boolean).map((part) => {
    const match = /^\[\[([^\]]+)\]\]$/.exec(part);
    if (!match) return { ...node, text: part };
    const [prefix, ...rest] = match[1].split(":");
    const types: EntityType[] = [
      "character",
      "location",
      "skill",
      "organization",
      "item",
      "concept",
    ];
    const entityType = types.includes(prefix as EntityType)
      ? (prefix as EntityType)
      : "character";
    const label = entityType === "character" ? match[1] : rest.join(":");
    const character =
      entityType === "character"
        ? characters.find((item) => item.name === label)
        : undefined;
    const generic =
      entityType === "character"
        ? null
        : resolveGenericReference(entities, entityType, label);
    return {
      type: "entityReference",
      attrs: {
        entityType,
        label,
        href:
          character && novelId
            ? `/novels/${novelId}/characters/${character.id}`
            : generic && novelId
              ? genericEntityHref(novelId, generic)
              : (linkedHref ?? null),
        linkedKeyword: !character && !generic && Boolean(linkedHref),
      },
    };
  });
}

function previewDocument(
  content: string,
  contentJson: RichNoteDocument | undefined,
  characters: Character[],
  entities: Entity[],
  novelId?: string,
): RichNoteDocument {
  const document = contentJson ?? createRichNoteDocument(content);
  return {
    ...document,
    content: document.content.flatMap((node) =>
      previewNode(node, characters, entities, novelId),
    ),
  };
}

function matchingEntities(entities: Entity[], query: string) {
  const [prefix, ...rest] = query.split(":");
  const entityTypes: EntityType[] = [
    "character",
    "location",
    "skill",
    "organization",
    "item",
    "concept",
  ];
  const type = entityTypes.includes(prefix as EntityType)
    ? (prefix as EntityType)
    : undefined;
  const search = (type ? rest.join(":") : query).trim().toLocaleLowerCase();
  return entities
    .filter(
      (entity) =>
        (!type || entity.type === type) &&
        (!search ||
          [entity.name, ...entity.aliases].some((value) =>
            value.toLocaleLowerCase().includes(search),
          )),
    )
    .slice(0, 8);
}

function renderEntityMenu() {
  let element: HTMLDivElement | null = null;
  let unmount: (() => void) | undefined;
  let selectedIndex = 0;
  let latest: SuggestionProps<Entity, Entity> | null = null;
  const choose = (index: number) => {
    const item = latest?.items[index];
    if (item) latest?.command(item);
  };
  const paint = (props: SuggestionProps<Entity, Entity>) => {
    if (!element) return;
    element.replaceChildren(
      ...props.items.map((entity, index) => {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = entitySyntax(entity.type, entity.name);
        button.className = `block w-full px-3 py-2 text-left text-sm ${index === selectedIndex ? "bg-stone-100" : "hover:bg-stone-50"}`;
        button.onmousedown = (event) => {
          event.preventDefault();
          choose(index);
        };
        return button;
      }),
    );
    element.hidden = props.items.length === 0;
  };
  return {
    onStart(props: SuggestionProps<Entity, Entity>) {
      latest = props;
      selectedIndex = 0;
      element = document.createElement("div");
      element.className =
        "z-50 max-h-56 min-w-52 overflow-y-auto rounded-xl border border-stone-200 bg-white py-1 shadow-lg";
      paint(props);
      unmount = props.mount(element);
    },
    onUpdate(props: SuggestionProps<Entity, Entity>) {
      latest = props;
      selectedIndex = Math.min(
        selectedIndex,
        Math.max(props.items.length - 1, 0),
      );
      paint(props);
    },
    onKeyDown({ event }: { event: KeyboardEvent }) {
      if (!latest?.items.length) return false;
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        selectedIndex =
          (selectedIndex +
            (event.key === "ArrowDown" ? 1 : -1) +
            latest.items.length) %
          latest.items.length;
        paint(latest);
        return true;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        choose(selectedIndex);
        return true;
      }
      return false;
    },
    onExit() {
      unmount?.();
      element = null;
      latest = null;
    },
  };
}

function entityReferenceExtension(entities: Entity[]) {
  return Node.create({
    name: "entityReference",
    group: "inline",
    inline: true,
    atom: true,
    addAttributes() {
      return {
        entityType: { default: "character" },
        label: { default: "" },
        href: { default: null },
        linkedKeyword: { default: false },
      };
    },
    parseHTML() {
      return [{ tag: "span[data-entity-reference]" }];
    },
    renderHTML({ HTMLAttributes }) {
      const label = String(HTMLAttributes.label ?? "");
      const type = String(
        HTMLAttributes.entityType ?? "character",
      ) as EntityType;
      const href = HTMLAttributes.href ? String(HTMLAttributes.href) : null;
      const linkedKeyword = Boolean(HTMLAttributes.linkedKeyword);
      return [
        href ? "a" : "span",
        {
          "data-entity-reference": "",
          "data-entity-type": type,
          ...(href
            ? { href, target: "_blank", rel: "noopener noreferrer" }
            : {}),
          class: linkedKeyword
            ? "font-medium !italic !text-[#1D7A75] underline decoration-[#1D7A75]/50 underline-offset-4 hover:!text-[#36E3DA] hover:decoration-[#36E3DA]/50"
            : href
              ? "font-medium text-sky-700 underline decoration-sky-200 underline-offset-4 hover:text-sky-900"
              : "text-stone-400",
        },
        label,
      ];
    },
    addProseMirrorPlugins() {
      return [
        Suggestion<Entity, Entity>({
          editor: this.editor,
          char: "[[",
          allowSpaces: true,
          allowedPrefixes: null,
          items: ({ query }) => matchingEntities(entities, query),
          command: ({ editor, range, props }) =>
            editor
              .chain()
              .focus()
              .deleteRange(range)
              .insertContent({
                type: "entityReference",
                attrs: { entityType: props.type, label: props.name },
              })
              .run(),
          render: renderEntityMenu,
        }),
      ];
    },
  });
}

const viewerExtensions = [
  StarterKit.configure({ heading: { levels: [3] }, link: false }),
  Highlight,
  Link.configure({ openOnClick: true }),
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

export function RichNoteContent({
  content,
  contentJson,
  characters = [],
  entities = [],
  novelId,
}: {
  content: string;
  contentJson?: RichNoteDocument;
  characters?: Character[];
  entities?: Entity[];
  novelId?: string;
}) {
  const renderedDocument = useMemo(
    () => previewDocument(content, contentJson, characters, entities, novelId),
    [content, contentJson, characters, entities, novelId],
  );
  const [linkPreview, setLinkPreview] = useState<
    (ExternalLinkPreview & { left: number; top: number }) | null
  >(null);
  const editor = useEditor(
    {
      immediatelyRender: false,
      editable: false,
      extensions: viewerExtensions,
      content: renderedDocument,
      editorProps: { attributes: { class: richNoteContentClassName } },
    },
    [],
  );
  useEffect(() => {
    editor?.commands.setContent(renderedDocument, { emitUpdate: false });
  }, [editor, renderedDocument]);
  function showLinkPreview(
    anchor: HTMLAnchorElement,
    container: HTMLElement,
    clientX: number,
    clientY: number,
  ) {
    const url = new URL(anchor.href, window.location.href);
    if (url.origin === window.location.origin) return;
    const rect = container.getBoundingClientRect();
    const position = {
      left: clientX - rect.left,
      top: clientY - rect.top + 24,
    };
    const cached = linkPreviewCache.get(url.href);
    if (cached) {
      setLinkPreview({ ...cached, ...position });
      return;
    }
    setLinkPreview({
      title: url.hostname,
      icon: null,
      domain: url.hostname,
      ...position,
    });
    void fetch(`/api/link-preview?url=${encodeURIComponent(url.href)}`)
      .then((response) =>
        response.ok ? (response.json() as Promise<ExternalLinkPreview>) : null,
      )
      .then((preview) => {
        if (preview) {
          linkPreviewCache.set(url.href, preview);
          setLinkPreview({ ...preview, ...position });
        }
      })
      .catch(() => undefined);
  }
  return editor ? (
    <div
      className="relative"
      onPointerOver={(event) => {
        const anchor = (event.target as HTMLElement).closest("a");
        if (anchor instanceof HTMLAnchorElement)
          showLinkPreview(
            anchor,
            event.currentTarget,
            event.clientX,
            event.clientY,
          );
      }}
      onFocus={(event) => {
        const anchor = (event.target as HTMLElement).closest("a");
        if (anchor instanceof HTMLAnchorElement) {
          const rect = anchor.getBoundingClientRect();
          showLinkPreview(anchor, event.currentTarget, rect.left, rect.bottom);
        }
      }}
      onPointerLeave={() => setLinkPreview(null)}>
      <EditorContent editor={editor} />
      {linkPreview ? (
        <div
          role="tooltip"
          className="pointer-events-none absolute z-20 flex max-w-64 items-center gap-2 rounded-lg bg-stone-900 px-3 py-2 text-xs text-white shadow-lg"
          style={{ left: linkPreview.left, top: linkPreview.top }}>
          {linkPreview.icon ? (
            // eslint-disable-next-line @next/next/no-img-element -- favicon hosts are dynamic external URLs.
            <img src={linkPreview.icon} alt="" className="size-4 rounded-sm" />
          ) : (
            <span className="grid size-4 place-items-center rounded-sm bg-stone-700 text-[9px]">
              ↗
            </span>
          )}
          <span className="min-w-0">
            <span className="block truncate font-medium">
              {linkPreview.title}
            </span>
            <span className="block truncate text-stone-400">
              {linkPreview.domain}
            </span>
          </span>
        </div>
      ) : null}
    </div>
  ) : null;
}

export function RichNoteEditor({
  initialContent,
  initialContentJson,
  entities,
  onChange,
}: {
  initialContent: string;
  initialContentJson?: RichNoteDocument;
  entities: Entity[];
  onChange: (value: { content: string; contentJson: RichNoteDocument }) => void;
}) {
  const [extensions] = useState(() => editorExtensions(entities));
  const [initialDocument] = useState(
    () => initialContentJson ?? createRichNoteDocument(initialContent),
  );
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const editor = useEditor(
    {
      immediatelyRender: false,
      extensions,
      content: initialDocument,
      editorProps: {
        attributes: {
          class: `min-h-32 px-3.5 py-2.5 outline-none ${richNoteContentClassName}`,
        },
      },
      onUpdate: ({ editor }) => {
        const contentJson = editor.getJSON() as RichNoteDocument;
        onChangeRef.current({
          content: richNoteDocumentToText(contentJson),
          contentJson,
        });
      },
    },
    [extensions],
  );
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkHref, setLinkHref] = useState("");
  const [linkError, setLinkError] = useState("");
  const linkDialogTitleId = useId();
  if (!editor) return null;
  const insertEntity = (entity: Entity) =>
    editor
      .chain()
      .focus()
      .insertContent({
        type: "entityReference",
        attrs: { entityType: entity.type, label: entity.name },
      })
      .run();
  const button = (
    label: string,
    icon: ReactNode,
    action: () => void,
    active = false,
  ) => (
    <button
      type="button"
      title={label}
      aria-label={label}
      onMouseDown={(event) => event.preventDefault()}
      onClick={action}
      className={`grid size-8 place-items-center rounded text-stone-700 transition [&_svg]:size-4 ${active ? "bg-stone-900 text-white" : "hover:bg-stone-100"}`}>
      {icon}
    </button>
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
  return (
    <div className="rounded-2xl border border-stone-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center gap-1 border-b border-stone-200 p-2">
        <div className="flex gap-0.5 border-r border-stone-200 pr-2">
          {button("Undo", icons.undo, () =>
            editor.chain().focus().undo().run(),
          )}
          {button("Redo", icons.redo, () =>
            editor.chain().focus().redo().run(),
          )}
        </div>
        <div className="flex gap-0.5 border-r border-stone-200 pr-2">
          {button(
            "Bold",
            icons.bold,
            () => editor.chain().focus().toggleBold().run(),
            editor.isActive("bold"),
          )}
          {button(
            "Italic",
            icons.italic,
            () => editor.chain().focus().toggleItalic().run(),
            editor.isActive("italic"),
          )}
          {button(
            "Strikethrough",
            icons.strike,
            () => editor.chain().focus().toggleStrike().run(),
            editor.isActive("strike"),
          )}
          {button(
            "Highlight",
            icons.highlight,
            () => editor.chain().focus().toggleHighlight().run(),
            editor.isActive("highlight"),
          )}
        </div>
        <div className="flex gap-0.5 border-r border-stone-200 pr-2">
          {button("Paragraph", icons.paragraph, () =>
            editor.chain().focus().setParagraph().run(),
          )}
          {button(
            "Heading 3",
            icons.heading,
            () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
            editor.isActive("heading", { level: 3 }),
          )}
          {button(
            "Bullet list",
            icons.bulletList,
            () => editor.chain().focus().toggleBulletList().run(),
            editor.isActive("bulletList"),
          )}
          {button(
            "Ordered list",
            icons.orderedList,
            () => editor.chain().focus().toggleOrderedList().run(),
            editor.isActive("orderedList"),
          )}
          {button(
            "Quote",
            icons.quote,
            () => editor.chain().focus().toggleBlockquote().run(),
            editor.isActive("blockquote"),
          )}
        </div>
        <div className="flex gap-0.5">
          {button(
            "Add link",
            icons.link,
            openLinkDialog,
            editor.isActive("link"),
          )}
          {button("Remove link", icons.unlink, () =>
            editor.chain().focus().unsetLink().run(),
          )}
          {button("Clear formatting", icons.clear, () =>
            editor.chain().focus().unsetAllMarks().clearNodes().run(),
          )}
        </div>
      </div>
      <div className="border-b border-stone-200 p-2">
        <select
          aria-label="Insert entity reference"
          defaultValue=""
          onChange={(event) => {
            const entity = entities.find(
              (item) => item.id === event.target.value,
            );
            if (entity) insertEntity(entity);
            event.currentTarget.value = "";
          }}
          className="max-w-full rounded border border-stone-200 bg-white px-2 py-1.5 text-xs">
          <option value="">[[ Entity reference ]]</option>
          {entities.map((entity) => (
            <option key={entity.id} value={entity.id}>
              {entity.type}: {entity.name}
            </option>
          ))}
        </select>
      </div>
      <EditorContent editor={editor} />
      <ModalDialog
        open={linkDialogOpen}
        onClose={() => setLinkDialogOpen(false)}
        labelledBy={linkDialogTitleId}
        className={`${modalPanelClassName} max-w-sm`}>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setLink();
          }}>
          <h3
            id={linkDialogTitleId}
            className="text-lg font-semibold tracking-[-0.03em] text-stone-950">
            Add link
          </h3>
          <label className="mt-4 block text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">
            URL
            <input
              autoFocus
              value={linkHref}
              onChange={(event) => {
                setLinkHref(event.target.value);
                setLinkError("");
              }}
              className={`${inputClassName} mt-1 w-full`}
              placeholder="https://example.com"
            />
          </label>
          {linkError ? (
            <p className="mt-2 text-sm text-rose-600">{linkError}</p>
          ) : null}
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setLinkDialogOpen(false)}
              className={secondaryButtonClassName}>
              Cancel
            </button>
            <button type="submit" className={primaryButtonClassName}>
              Add link
            </button>
          </div>
        </form>
      </ModalDialog>
    </div>
  );
}
