"use client";

import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  ImagePlus,
  Pencil,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import Image from "next/image";
import { useId, useMemo, useState } from "react";
import type { GalleryImage, GalleryImageCategory } from "@/app/types";
import { Select } from "@/components/ui/Select";
import ModalDialog from "@/components/a11y/ModalDialog";
import {
  cardClassName,
  dangerIconButtonClassName,
  inputClassName,
  modalPanelClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
  smallLabelClassName,
} from "../../../ui";

const categories: Array<{ value: GalleryImageCategory; label: string }> = [
  { value: "official", label: "Official" },
  { value: "anime", label: "Anime" },
  { value: "manga", label: "Manga" },
  { value: "light-novel", label: "Light Novel" },
  { value: "fan-art", label: "Fan Art" },
  { value: "other", label: "Other" },
];

function ordered(gallery: GalleryImage[]) {
  return [...gallery].sort((left, right) => left.sort_order - right.sort_order);
}

function normalizeOrder(gallery: GalleryImage[]) {
  return gallery.map((image, index) => ({
    ...image,
    sort_order: index + 1,
  }));
}

function emptyImage(sortOrder: number): GalleryImage {
  return {
    id: crypto.randomUUID(),
    image_url: "",
    category: "other",
    sort_order: sortOrder,
  };
}

export default function CharacterGallery({
  gallery,
  canEdit,
  onSave,
}: {
  gallery: GalleryImage[];
  canEdit: boolean;
  onSave: (gallery: GalleryImage[]) => Promise<void>;
}) {
  const [category, setCategory] = useState<GalleryImageCategory | "all">("all");
  const [activeImageId, setActiveImageId] = useState<string | null>(null);
  const [draft, setDraft] = useState<GalleryImage | null>(null);
  const [previewImage, setPreviewImage] = useState<GalleryImage | null>(null);
  const [reorderDraft, setReorderDraft] = useState<GalleryImage[] | null>(null);
  const [saving, setSaving] = useState(false);
  const sorted = useMemo(() => ordered(gallery), [gallery]);
  const images =
    category === "all"
      ? sorted
      : sorted.filter((image) => image.category === category);
  const selectedIndex = Math.max(
    0,
    images.findIndex((image) => image.id === activeImageId),
  );

  if (!canEdit && sorted.length === 0) return null;

  async function persist(nextGallery: GalleryImage[]) {
    setSaving(true);
    try {
      await onSave(normalizeOrder(nextGallery));
      return true;
    } catch {
      // The parent surfaces the Firebase/FormError message consistently.
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function saveImage() {
    if (!draft || !draft.image_url.trim()) return;
    const exists = sorted.some((image) => image.id === draft.id);
    const nextGallery = exists
      ? sorted.map((image) => (image.id === draft.id ? draft : image))
      : [...sorted, draft];
    if (await persist(nextGallery)) setDraft(null);
  }

  async function removeImage(imageId: string) {
    if (await persist(sorted.filter((image) => image.id !== imageId))) {
      setDraft(null);
    }
  }

  async function saveOrder() {
    if (!reorderDraft) return;
    if (await persist(reorderDraft)) setReorderDraft(null);
  }

  function move(imageId: string, direction: -1 | 1) {
    setReorderDraft((currentDraft) => {
      if (!currentDraft) return currentDraft;
      const current = currentDraft.findIndex((image) => image.id === imageId);
      const next = current + direction;
      if (current < 0 || next < 0 || next >= currentDraft.length) {
        return currentDraft;
      }
      const reordered = [...currentDraft];
      [reordered[current], reordered[next]] = [
        reordered[next],
        reordered[current],
      ];
      return reordered;
    });
  }

  function changeActiveImage(direction: -1 | 1) {
    if (images.length < 2) return;
    const nextIndex =
      (selectedIndex + direction + images.length) % images.length;
    setActiveImageId(images[nextIndex].id);
  }

  return (
    <section className={`${cardClassName} space-y-5`}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className={smallLabelClassName}>Gallery</p>
          <h2 className="mt-1 text-lg font-semibold tracking-[-0.03em] text-stone-950">
            Visual diary
          </h2>
        </div>
        {canEdit ? (
          <div className="flex flex-wrap items-center gap-2">
            {reorderDraft ? (
              <>
                <button
                  type="button"
                  className={secondaryButtonClassName}
                  disabled={saving}
                  onClick={() => setReorderDraft(null)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className={primaryButtonClassName}
                  disabled={saving}
                  onClick={() => void saveOrder()}>
                  {saving ? "Saving…" : "Save order"}
                </button>
              </>
            ) : (
              <>
                {sorted.length > 1 ? (
                  <button
                    type="button"
                    className={secondaryButtonClassName}
                    disabled={saving || draft !== null}
                    onClick={() => setReorderDraft(sorted)}>
                    <SlidersHorizontal aria-hidden="true" size={16} /> Rearrange
                  </button>
                ) : null}
                <button
                  type="button"
                  className={secondaryButtonClassName}
                  disabled={saving || draft !== null}
                  onClick={() => setDraft(emptyImage(sorted.length + 1))}>
                  <ImagePlus aria-hidden="true" size={16} /> Add image
                </button>
              </>
            )}
          </div>
        ) : null}
      </div>

      {reorderDraft ? (
        <ReorderList gallery={reorderDraft} onMove={move} />
      ) : (
        <>
          {sorted.length > 0 ? (
            <>
              <div className="flex gap-2 overflow-x-auto pb-1">
                <CategoryChip
                  active={category === "all"}
                  onClick={() => setCategory("all")}>
                  All
                </CategoryChip>
                {categories
                  .filter(({ value }) =>
                    sorted.some((image) => image.category === value),
                  )
                  .map(({ value, label }) => (
                    <CategoryChip
                      key={value}
                      active={category === value}
                      onClick={() => setCategory(value)}>
                      {label}
                    </CategoryChip>
                  ))}
              </div>
              <GalleryCarousel
                images={images}
                selectedIndex={selectedIndex}
                canEdit={canEdit}
                onSelect={setActiveImageId}
                onPrevious={() => changeActiveImage(-1)}
                onNext={() => changeActiveImage(1)}
                onEdit={setDraft}
                onPreview={setPreviewImage}
              />
            </>
          ) : (
            <p className="text-sm text-stone-500">
              {canEdit
                ? "Add image source URLs to build this gallery."
                : "No gallery images yet."}
            </p>
          )}
          {draft ? (
            <ImageEditor
              image={draft}
              isNew={!sorted.some((image) => image.id === draft.id)}
              saving={saving}
              onChange={(patch) =>
                setDraft((current) => current && { ...current, ...patch })
              }
              onCancel={() => setDraft(null)}
              onSave={() => void saveImage()}
              onRemove={() => void removeImage(draft.id)}
            />
          ) : null}
        </>
      )}
      {previewImage ? (
        <GalleryImagePreviewModal
          image={previewImage}
          onClose={() => setPreviewImage(null)}
        />
      ) : null}
    </section>
  );
}

function GalleryCarousel({
  images,
  selectedIndex,
  canEdit,
  onSelect,
  onPrevious,
  onNext,
  onEdit,
  onPreview,
}: {
  images: GalleryImage[];
  selectedIndex: number;
  canEdit: boolean;
  onSelect: (imageId: string) => void;
  onPrevious: () => void;
  onNext: () => void;
  onEdit: (image: GalleryImage) => void;
  onPreview: (image: GalleryImage) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="relative h-54 overflow-hidden sm:h-68">
        {images.map((image, index) => {
          const position = index - selectedIndex;
          if (Math.abs(position) > 2) return null;
          return (
            <GalleryImageCard
              key={image.id}
              image={image}
              position={position}
              active={position === 0}
              canEdit={canEdit}
              onSelect={() => onSelect(image.id)}
              onEdit={() => onEdit(image)}
              onPreview={() => onPreview(image)}
            />
          );
        })}
      </div>
      {images.length > 1 ? (
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={onPrevious}
            aria-label="Previous image"
            className="inline-flex size-9 items-center justify-center rounded-full border border-stone-300 bg-white text-stone-700 shadow-sm transition hover:border-stone-500 hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-300">
            <ChevronLeft aria-hidden="true" size={16} />
          </button>
          <span className="min-w-12 text-center text-xs tabular-nums text-stone-500">
            {selectedIndex + 1} / {images.length}
          </span>
          <button
            type="button"
            onClick={onNext}
            aria-label="Next image"
            className="inline-flex size-9 items-center justify-center rounded-full border border-stone-300 bg-white text-stone-700 shadow-sm transition hover:border-stone-500 hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-300">
            <ChevronRight aria-hidden="true" size={16} />
          </button>
        </div>
      ) : null}
    </div>
  );
}

function GalleryImageCard({
  image,
  position,
  active,
  canEdit,
  onSelect,
  onEdit,
  onPreview,
}: {
  image: GalleryImage;
  position: number;
  active: boolean;
  canEdit: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onPreview: () => void;
}) {
  const cardLabel = `View full image: ${image.title || image.caption || "gallery image"}`;
  const activateCard = active
    ? onPreview
    : () => {
        onSelect();
        onPreview();
      };

  return (
    <article
      role="button"
      tabIndex={0}
      aria-label={cardLabel}
      onClick={activateCard}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          activateCard();
        }
      }}
      style={{
        transform: `translateX(calc(-50% + ${position * 14.5}rem)) scale(${active ? 1 : 0.82})`,
        zIndex: active ? 30 : 20 - Math.abs(position),
      }}
      className={`group absolute left-1/2 top-3 aspect-4/3 w-64 cursor-zoom-in overflow-hidden rounded-2xl bg-stone-100 shadow-lg outline-none transition-[transform,opacity] duration-500 ease-out focus-visible:ring-2 focus-visible:ring-stone-900 sm:top-5 sm:w-80 ${active ? "opacity-100" : "hidden opacity-70 hover:opacity-100 sm:block"}`}>
      <Image
        fill
        src={image.image_url}
        alt={image.title || image.caption || "Character gallery image"}
        priority={active}
        sizes="(min-width: 640px) 320px, 256px"
        className="object-cover transition duration-300 group-hover:scale-[1.02]"
        unoptimized={/\.gif(?:$|\?)/i.test(image.image_url)}
      />
      {canEdit ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onEdit();
          }}
          className="absolute right-3 top-3 z-20 inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 text-xs font-medium text-stone-700 opacity-0 shadow-sm transition hover:bg-white focus-visible:opacity-100 group-hover:opacity-100">
          <Pencil aria-hidden="true" size={13} /> Edit
        </button>
      ) : null}
      {image.title || image.caption || image.source_url ? (
        <div className="absolute inset-x-0 bottom-0 z-20 bg-linear-to-t from-stone-950/80 to-transparent px-4 pb-3 pt-10 text-stone-50">
          {image.title ? (
            <p className="text-sm font-semibold">{image.title}</p>
          ) : null}
          {image.caption ? (
            <p className="mt-0.5 text-xs text-stone-200">{image.caption}</p>
          ) : null}
          {image.source_url ? (
            <a
              href={image.source_url}
              target="_blank"
              rel="noreferrer"
              onClick={(event) => event.stopPropagation()}
              className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-white underline underline-offset-2">
              Source <ExternalLink aria-hidden="true" size={12} />
            </a>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function GalleryImagePreviewModal({
  image,
  onClose,
}: {
  image: GalleryImage;
  onClose: () => void;
}) {
  const titleId = useId();
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const title = image.title || image.caption || "Character gallery image";

  return (
    <ModalDialog
      open
      onClose={onClose}
      labelledBy={titleId}
      className={`${modalPanelClassName} h-fit! w-fit! max-w-[calc(100dvw-2rem)]! overflow-hidden`}>
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2
          id={titleId}
          className="min-w-0 truncate text-lg font-semibold text-stone-950">
          {title}
        </h2>
        <button
          type="button"
          onClick={onClose}
          className={secondaryButtonClassName}>
          Close
        </button>
      </div>
      <div className="relative">
        {!imageLoaded && !imageFailed ? (
          <div
            aria-hidden="true"
            className="absolute inset-0 animate-pulse rounded-2xl bg-stone-200"
          />
        ) : null}
        {imageFailed ? (
          <p
            role="alert"
            className="flex h-[70dvh] min-h-60 min-w-60 items-center justify-center rounded-2xl bg-stone-100 px-6 text-center text-sm text-stone-500">
            Unable to load this image.
          </p>
        ) : (
          <Image
            src={image.image_url}
            alt={title}
            width={1600}
            height={1200}
            referrerPolicy="no-referrer"
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageFailed(true)}
            unoptimized
            className={`h-[70dvh] max-h-[calc(100dvh-9rem)] max-w-[calc(100dvw-4rem)] rounded-2xl object-contain transition-opacity duration-200 ${imageLoaded ? "opacity-100" : "opacity-0"}`}
          />
        )}
      </div>
    </ModalDialog>
  );
}

function ReorderList({
  gallery,
  onMove,
}: {
  gallery: GalleryImage[];
  onMove: (imageId: string, direction: -1 | 1) => void;
}) {
  return (
    <div className="space-y-2 rounded-2xl border border-stone-200 bg-stone-50/70 p-3">
      <p className="px-1 text-sm text-stone-500">
        Arrange images, then save the order once.
      </p>
      {gallery.map((image, index) => (
        <div
          key={image.id}
          className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2.5 shadow-sm">
          <span className="min-w-0 truncate text-sm font-medium text-stone-700">
            {image.title || image.caption || `Image ${index + 1}`}
          </span>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => onMove(image.id, -1)}
              disabled={index === 0}
              aria-label={`Move ${image.title || `image ${index + 1}`} up`}
              className="rounded-lg px-2 py-1 text-sm text-stone-600 hover:bg-stone-100 disabled:opacity-40">
              ↑
            </button>
            <button
              type="button"
              onClick={() => onMove(image.id, 1)}
              disabled={index === gallery.length - 1}
              aria-label={`Move ${image.title || `image ${index + 1}`} down`}
              className="rounded-lg px-2 py-1 text-sm text-stone-600 hover:bg-stone-100 disabled:opacity-40">
              ↓
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function ImageEditor({
  image,
  isNew,
  saving,
  onChange,
  onCancel,
  onSave,
  onRemove,
}: {
  image: GalleryImage;
  isNew: boolean;
  saving: boolean;
  onChange: (patch: Partial<GalleryImage>) => void;
  onCancel: () => void;
  onSave: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="space-y-4 rounded-2xl border border-stone-200 bg-stone-50/70 p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-stone-800">
          {isNew ? "Add image" : "Edit image"}
        </h3>
        {!isNew ? (
          <button
            type="button"
            className={dangerIconButtonClassName}
            disabled={saving}
            onClick={onRemove}
            aria-label="Remove image">
            <Trash2 aria-hidden="true" size={16} />
          </button>
        ) : null}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label="Image URL *"
          value={image.image_url}
          type="url"
          onChange={(image_url) => onChange({ image_url })}
        />
        <Field
          label="Category"
          value={image.category ?? "other"}
          options={categories}
          onChange={(category) =>
            onChange({ category: category as GalleryImageCategory })
          }
        />
        <Field
          label="Title"
          value={image.title ?? ""}
          onChange={(title) => onChange({ title: title || undefined })}
        />
        <Field
          label="Caption"
          value={image.caption ?? ""}
          onChange={(caption) => onChange({ caption: caption || undefined })}
        />
        <div className="sm:col-span-2">
          <Field
            label="Source URL"
            value={image.source_url ?? ""}
            type="url"
            onChange={(source_url) =>
              onChange({ source_url: source_url || undefined })
            }
          />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          className={secondaryButtonClassName}
          disabled={saving}
          onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className={primaryButtonClassName}
          disabled={saving || !image.image_url.trim()}
          onClick={onSave}>
          {saving ? "Saving…" : "Save image"}
        </button>
      </div>
    </div>
  );
}

function CategoryChip({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition ${active ? "border-stone-900 bg-stone-900 text-white" : "border-stone-300 bg-white text-stone-600 hover:border-stone-500"}`}>
      {children}
    </button>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "url";
  options?: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="block text-[11px] font-medium text-stone-500">
      {label}
      {options ? (
        <Select
          value={value}
          onValueChange={onChange}
          options={options}
          wrapperClassName="mt-1"
          className="py-2 text-sm"
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={`${inputClassName} mt-1 text-sm`}
        />
      )}
    </label>
  );
}
