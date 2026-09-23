"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Entity, EntityNote } from "@/libs/entities/types";
import type { RichNoteDocument } from "@/libs/richNotes/document";
import { updateEntity } from "@/libs/api";
import { useAuth } from "@/components/auth/AuthProvider";
import { useI18n } from "@/components/i18n/I18nProvider";
import { RichNoteContent, RichNoteEditor } from "@/components/notes/RichNoteEditor";
import { userErrorMessage } from "@/libs/userErrorMessage";
import {
  cardClassName,
  FormError,
  primaryButtonClassName,
  secondaryButtonClassName,
} from "../../../ui";
import ConfirmDialog from "../../../ConfirmDialog";

function nextId() {
  return crypto.randomUUID();
}

export default function EntityNotesEditor({ novelId, entity }: { novelId: string; entity: Entity }) {
  const { t, language } = useI18n();
  const { isAdmin } = useAuth();
  const router = useRouter();
  const [notes, setNotes] = useState(entity.notes ?? []);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [contentJson, setContentJson] = useState<RichNoteDocument | undefined>();
  const [deleting, setDeleting] = useState<EntityNote | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function begin(note?: EntityNote) {
    setEditingId(note?.id ?? "__new__");
    setContent(note?.content ?? "");
    setContentJson(note?.content_json);
    setError(null);
  }

  async function persist(next: EntityNote[]) {
    setSaving(true);
    setError(null);
    try {
      const updated = await updateEntity(novelId, entity.id, { notes: next });
      setNotes(updated.notes ?? []);
      setEditingId(null);
      setContent("");
      setContentJson(undefined);
      setDeleting(null);
      router.refresh();
    } catch (cause) {
      setError(userErrorMessage(cause, t));
    } finally {
      setSaving(false);
    }
  }

  async function save() {
    const trimmed = content.trim();
    if (!trimmed) {
      setError(t("entities.noteRequired"));
      return;
    }
    const now = new Date().toISOString();
    const next = editingId === "__new__"
      ? [...notes, { id: nextId(), content: trimmed, ...(contentJson ? { content_json: contentJson } : {}), created_at: now, updated_at: now }]
      : notes.map((note) => note.id === editingId ? { ...note, content: trimmed, ...(contentJson ? { content_json: contentJson } : {}), updated_at: now } : note);
    await persist(next);
  }

  return (
    <section className={cardClassName}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-[0.24em] text-stone-500">{t("entities.notes")}</h2>
        {isAdmin && editingId === null ? <button type="button" onClick={() => begin()} className={secondaryButtonClassName}>{t("entities.addNote")}</button> : null}
      </div>
      <div className="space-y-3">
        {notes.map((note, index) => (
          <article key={note.id} className="rounded-2xl border border-stone-200 bg-stone-50/60 p-4">
            <div className="mb-2 flex items-center justify-between gap-2 text-xs text-stone-500">
              <span>{t("entities.noteNumber", { number: index + 1 })}</span>
              <time dateTime={note.updated_at}>{new Date(note.updated_at).toLocaleString(language)}</time>
            </div>
            {editingId === note.id ? <NoteForm value={content} contentJson={contentJson} onChange={(next) => { setContent(next.content); setContentJson(next.contentJson); }} onSave={() => void save()} onCancel={() => setEditingId(null)} saving={saving} /> : <>
              <RichNoteContent content={note.content} contentJson={note.content_json} />
              {isAdmin ? <div className="mt-3 flex justify-end gap-2"><button type="button" onClick={() => begin(note)} className={secondaryButtonClassName}>{t("common.edit")}</button><button type="button" onClick={() => setDeleting(note)} className={secondaryButtonClassName}>{t("common.delete")}</button></div> : null}
            </>}
          </article>
        ))}
        {editingId === "__new__" ? <article className="rounded-2xl border border-dashed border-stone-300 p-4"><NoteForm value={content} contentJson={contentJson} onChange={(next) => { setContent(next.content); setContentJson(next.contentJson); }} onSave={() => void save()} onCancel={() => setEditingId(null)} saving={saving} /></article> : null}
        {notes.length === 0 && editingId === null ? <p className="py-5 text-center text-sm text-stone-500">{t("entities.noNotes")}</p> : null}
      </div>
      {error ? <FormError>{error}</FormError> : null}
      <ConfirmDialog open={isAdmin && Boolean(deleting)} eyebrow={t("entities.notes")} title={t("entities.deleteNoteTitle")} description={t("entities.deleteNoteBody")} confirmLabel={t("common.delete")} cancelLabel={t("common.cancel")} onConfirm={() => void persist(notes.filter((note) => note.id !== deleting?.id))} onCancel={() => setDeleting(null)} busy={saving} danger />
    </section>
  );
}

function NoteForm({ value, contentJson, onChange, onSave, onCancel, saving }: { value: string; contentJson?: RichNoteDocument; onChange: (value: { content: string; contentJson: RichNoteDocument }) => void; onSave: () => void; onCancel: () => void; saving: boolean }) {
  const { t } = useI18n();
  return <div className="space-y-3"><RichNoteEditor key={value} initialContent={value} initialContentJson={contentJson} entities={[]} enableEntityReferences={false} onChange={onChange} /><div className="flex justify-end gap-2"><button type="button" onClick={onCancel} disabled={saving} className={secondaryButtonClassName}>{t("common.cancel")}</button><button type="button" onClick={onSave} disabled={saving} className={primaryButtonClassName}>{saving ? t("common.saving") : t("common.save")}</button></div></div>;
}
