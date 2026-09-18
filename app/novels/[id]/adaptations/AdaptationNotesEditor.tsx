"use client";

import { useMemo, useState } from "react";
import type { Adaptation, ChapterNote, Character } from "@/app/types";
import type { Entity } from "@/libs/entities/types";
import ConfirmDialog from "@/app/novels/ConfirmDialog";
import {
  FormError,
  ghostButtonClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
  smallLabelClassName,
  Snackbar,
} from "@/app/novels/ui";
import { useAuth } from "@/components/auth/AuthProvider";
import { useI18n } from "@/components/i18n/I18nProvider";
import { updateAdaptation } from "@/libs/api";
import { userErrorMessage } from "@/libs/userErrorMessage";
import { RichNoteContent, RichNoteEditor } from "@/components/notes/RichNoteEditor";
import type { RichNoteDocument } from "@/libs/richNotes/document";

const NOTES_PER_PAGE = 5;

function nextId() {
  return crypto.randomUUID();
}

export default function AdaptationNotesEditor({
  adaptation,
  characters,
  genericEntities,
  onUpdated,
  onMessage,
}: {
  adaptation: Adaptation;
  characters: Character[];
  genericEntities: Entity[];
  onUpdated?: (adaptation: Adaptation) => void;
  onMessage?: (message: string) => void;
}) {
  const { t, language } = useI18n();
  const { isAdmin } = useAuth();
  const [notes, setNotes] = useState(adaptation.notes);
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<ChapterNote | null>(null);
  const [draft, setDraft] = useState("");
  const [draftJson, setDraftJson] = useState<RichNoteDocument | undefined>();
  const [deleting, setDeleting] = useState<ChapterNote | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const pages = Math.max(1, Math.ceil(notes.length / NOTES_PER_PAGE));
  const currentPage = Math.min(page, pages);
  const firstIndex = (currentPage - 1) * NOTES_PER_PAGE;
  const visibleNotes = notes.slice(firstIndex, firstIndex + NOTES_PER_PAGE);
  const entities = useMemo(() => [...characters.map((character) => ({ id: `${adaptation.novel_id}:character:${character.id}`, novelId: adaptation.novel_id, type: "character" as const, name: character.name, aliases: character.aliases, description: character.description })), ...genericEntities], [adaptation.novel_id, characters, genericEntities]);

  function begin(note?: ChapterNote) {
    setEditing(note ?? { id: "", content: "", created_at: "", updated_at: "" });
    setDraft(note?.content ?? "");
    setDraftJson(note?.content_json);
    setError(null);
  }

  async function persist(next: ChapterNote[]) {
    setSaving(true);
    setError(null);
    try {
      const updated = await updateAdaptation(
        adaptation.novel_id,
        adaptation.volume_id,
        adaptation.id,
        { notes: next },
      );
      setNotes(updated.notes);
      onUpdated?.(updated);
      const message = t("adaptations.notesSaved");
      if (onMessage) onMessage(message);
      else setSuccess(message);
      return updated;
    } catch (cause) {
      setError(userErrorMessage(cause, t));
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function save() {
    if (!editing) return;
    const content = draft.trim();
    if (!content) {
      setError(t("adaptations.noteRequired"));
      return;
    }
    const now = new Date().toISOString();
    const note = editing.id
      ? { ...editing, content, ...(draftJson ? { content_json: draftJson } : {}), updated_at: now }
      : { id: nextId(), content, ...(draftJson ? { content_json: draftJson } : {}), created_at: now, updated_at: now };
    const next = editing.id
      ? notes.map((item) => (item.id === note.id ? note : item))
      : [...notes, note];
    if (await persist(next)) {
      if (!editing.id) setPage(Math.ceil(next.length / NOTES_PER_PAGE));
      setEditing(null);
      setDraft("");
      setDraftJson(undefined);
    }
  }

  async function remove() {
    if (!deleting) return;
    const next = notes.filter((note) => note.id !== deleting.id);
    if (await persist(next)) {
      setDeleting(null);
      setPage((current) => Math.min(current, Math.max(1, Math.ceil(next.length / NOTES_PER_PAGE))));
    }
  }

  return (
    <section className="mt-4 border-t border-stone-200 pt-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h4 className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">
          {t("adaptations.notes")}
        </h4>
        {isAdmin && !editing ? (
          <button type="button" className={secondaryButtonClassName} onClick={() => begin()}>
            {t("adaptations.addNote")}
          </button>
        ) : null}
      </div>
      <div className="space-y-3">
        {visibleNotes.map((note, index) => (
          <article key={note.id} className="rounded-2xl bg-stone-50 p-3 ring-1 ring-stone-200/70">
            <div className="mb-2 flex items-center justify-between gap-2 text-xs text-stone-500">
              <span>{t("adaptations.noteNumber", { number: firstIndex + index + 1 })}</span>
              <time dateTime={note.updated_at}>{new Date(note.updated_at).toLocaleString(language)}</time>
            </div>
            {editing?.id === note.id ? (
              <NoteForm value={draft} contentJson={draftJson} entities={entities} onChange={(next) => { setDraft(next.content); setDraftJson(next.contentJson); }} onSave={() => void save()} onCancel={() => setEditing(null)} saving={saving} />
            ) : (
              <>
                <RichNoteContent content={note.content} contentJson={note.content_json} />
                {isAdmin ? (
                  <div className="mt-3 flex justify-end gap-2">
                    <button type="button" className={secondaryButtonClassName} onClick={() => begin(note)}>{t("common.edit")}</button>
                    <button type="button" className={ghostButtonClassName} disabled={saving} onClick={() => setDeleting(note)}>{t("common.delete")}</button>
                  </div>
                ) : null}
              </>
            )}
          </article>
        ))}
        {editing && !editing.id ? (
          <article className="rounded-2xl border border-dashed border-stone-300 p-3">
            <NoteForm value={draft} contentJson={draftJson} entities={entities} onChange={(next) => { setDraft(next.content); setDraftJson(next.contentJson); }} onSave={() => void save()} onCancel={() => setEditing(null)} saving={saving} />
          </article>
        ) : null}
        {notes.length === 0 && !editing ? <p className="py-3 text-sm text-stone-500">{t("adaptations.noNotes")}</p> : null}
      </div>
      {notes.length > NOTES_PER_PAGE ? (
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-sm text-stone-500">{t("common.pageOf", { page: currentPage, total: pages })}</p>
          <div className="flex gap-2">
            <button type="button" className={secondaryButtonClassName} disabled={currentPage === 1} onClick={() => setPage((current) => current - 1)}>{t("common.previous")}</button>
            <button type="button" className={secondaryButtonClassName} disabled={currentPage === pages} onClick={() => setPage((current) => current + 1)}>{t("common.next")}</button>
          </div>
        </div>
      ) : null}
      {error ? <FormError>{error}</FormError> : null}
      <ConfirmDialog
        open={isAdmin && Boolean(deleting)}
        eyebrow={t("adaptations.notes")}
        title={t("adaptations.deleteNoteTitle")}
        description={t("adaptations.deleteNoteBody")}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        onConfirm={() => void remove()}
        onCancel={() => setDeleting(null)}
        busy={saving}
        danger
      />
      <Snackbar
        open={Boolean(success)}
        message={success ?? ""}
        onClose={() => setSuccess(null)}
        closeLabel={t("common.close")}
      />
    </section>
  );
}

function NoteForm({ value, contentJson, entities, onChange, onSave, onCancel, saving }: { value: string; contentJson?: RichNoteDocument; entities: import("@/libs/entities/types").Entity[]; onChange: (value: { content: string; contentJson: RichNoteDocument }) => void; onSave: () => void; onCancel: () => void; saving: boolean }) {
  const { t } = useI18n();
  return <div>
    <label className={smallLabelClassName}>{t("adaptations.noteContent")}</label>
    <RichNoteEditor initialContent={value} initialContentJson={contentJson} entities={entities} onChange={onChange} />
    <p className="mt-2 text-xs text-stone-500">{t("adaptations.noteReferenceHint")}</p>
    <div className="mt-3 flex justify-end gap-2">
      <button type="button" disabled={saving} onClick={onCancel} className={secondaryButtonClassName}>{t("common.cancel")}</button>
      <button type="button" disabled={saving} onClick={onSave} className={primaryButtonClassName}>{saving ? t("common.saving") : t("common.save")}</button>
    </div>
  </div>;
}
