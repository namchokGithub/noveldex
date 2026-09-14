"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { modalKeyboardAction } from "@/libs/modalKeyboard";

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function ModalDialog({
  open,
  onClose,
  labelledBy,
  className,
  children,
  busy = false,
}: {
  open: boolean;
  onClose: () => void;
  labelledBy: string;
  className: string;
  children: ReactNode;
  busy?: boolean;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    openerRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();

    const frame = window.requestAnimationFrame(() => {
      dialog.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)?.focus();
    });

    return () => {
      window.cancelAnimationFrame(frame);
      if (dialog.open) dialog.close();
      window.requestAnimationFrame(() => openerRef.current?.focus());
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  function requestClose() {
    if (!busy) onClose();
  }

  return (
    <dialog
      ref={dialogRef}
      aria-modal="true"
      aria-labelledby={labelledBy}
      className={`${className} fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] overflow-y-auto backdrop:bg-stone-950/40 backdrop:backdrop-blur-sm`}
      onCancel={(event) => {
        event.preventDefault();
        requestClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) requestClose();
      }}
      onKeyDown={(event) => {
        if (modalKeyboardAction(event.key, busy) === "close") {
          event.preventDefault();
          requestClose();
        }
      }}>
      {children}
    </dialog>
  );
}
