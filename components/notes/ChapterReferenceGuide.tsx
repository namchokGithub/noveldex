"use client";

import { BookOpen, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { EntityType } from "@/libs/entities/types";
import { TAG_COLORS } from "@/libs/richNotes/tagColors";

const references: { type: EntityType; syntax: string; label: string }[] = [
  { type: "character", syntax: "[[Rimuru]]", label: "Character" },
  { type: "location", syntax: "[[location:Tempest]]", label: "Location" },
  { type: "skill", syntax: "[[skill:Predator]]", label: "Skill" },
  { type: "organization", syntax: "[[organization:Jura-Tempest Federation]]", label: "Organization" },
  { type: "item", syntax: "[[item:Elpis]]", label: "Item" },
  { type: "concept", syntax: "[[concept:Rank]]", label: "Concept" },
];

export default function ChapterReferenceGuide({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label="Reference guide"
        aria-expanded={open}
        aria-controls="chapter-reference-guide"
        onClick={() => setOpen((current) => !current)}
        className="inline-flex h-9 items-center gap-1.5 rounded-full border border-stone-200 bg-white px-3 text-sm font-medium text-stone-600 shadow-sm transition hover:border-stone-300 hover:bg-stone-50 hover:text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400">
        <BookOpen aria-hidden="true" size={15} /> Guide
      </button>
      {open ? (
        <div
          id="chapter-reference-guide"
          role="dialog"
          aria-label="Note reference guide"
          className="absolute right-0 top-[calc(100%+0.5rem)] z-30 w-[min(22rem,calc(100vw-3rem))] rounded-2xl border border-stone-200 bg-white p-4 shadow-[0_12px_28px_rgba(28,25,23,0.14)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-stone-900">Reference guide</h3>
              <p className="mt-1 text-xs leading-5 text-stone-500">Type a reference in a note to connect it to a story record.</p>
            </div>
            <button
              type="button"
              aria-label="Close reference guide"
              onClick={() => setOpen(false)}
              className="rounded-full p-1 text-stone-400 transition hover:bg-stone-100 hover:text-stone-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400">
              <X aria-hidden="true" size={16} />
            </button>
          </div>
          <div className="mt-4 space-y-2">
            {references.map(({ type, syntax, label }) => {
              const color = TAG_COLORS[type];
              return (
                <div key={type} className="flex items-center justify-between gap-3 rounded-xl bg-stone-50 px-3 py-2">
                  <code className="min-w-0 truncate text-xs text-stone-700">{syntax}</code>
                  <span
                    className="shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold"
                    style={{ color: color.color, borderColor: color.color, backgroundColor: color.underline }}>
                    {label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
