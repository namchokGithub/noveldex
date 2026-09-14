"use client";

import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  modalPanelClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
} from "./ui";

export default function ConfirmDialog({
  open,
  eyebrow,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  busy = false,
  danger = false,
}: {
  open: boolean;
  eyebrow: ReactNode;
  title: ReactNode;
  description: ReactNode;
  confirmLabel: ReactNode;
  cancelLabel: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
  danger?: boolean;
}) {
  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-stone-950/40 px-4 backdrop-blur-sm">
      <div className={`${modalPanelClassName} max-w-sm`}>
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-stone-500">
            {eyebrow}
          </p>
          <h3 className="text-lg font-semibold tracking-[-0.03em] text-stone-950">
            {title}
          </h3>
          <p className="text-sm leading-6 text-stone-600">{description}</p>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className={secondaryButtonClassName}>
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className={
              danger
                ? `${primaryButtonClassName} bg-rose-600 hover:bg-rose-500`
                : primaryButtonClassName
            }>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
