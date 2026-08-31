import type { ReactNode } from "react";
import ExpandableDescription from "./ExpandableDescription";

export const pageRootClassName =
  "min-h-screen bg-[linear-gradient(180deg,#f8f6f0_0%,#f3efe6_52%,#ece7db_100%)] px-4 py-6 text-stone-900 sm:px-6 sm:py-8";

export const shellClassName =
  "rounded-[28px] border border-white/70 bg-white/80 p-4 shadow-[0_20px_80px_rgba(120,108,84,0.12)] backdrop-blur sm:p-6";

export const innerShellClassName =
  "flex flex-col gap-5 rounded-[24px] border border-stone-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(245,240,232,0.92))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] sm:p-5";

export const cardClassName =
  "rounded-[22px] border border-stone-200 bg-white/80 p-5 shadow-[0_12px_32px_rgba(120,108,84,0.10)]";

export const mutedCardClassName =
  "rounded-[22px] border border-stone-200 bg-stone-50/90 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]";

export const listClassName =
  "overflow-hidden rounded-[22px] border border-stone-200 bg-white/80 shadow-sm";

export const listRowClassName =
  "flex items-center justify-between gap-4 px-4 py-4 transition hover:bg-stone-50/90";

export const backLinkClassName =
  "inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white/80 px-3 py-1.5 text-sm text-stone-600 shadow-sm transition hover:border-stone-300 hover:text-stone-900";

export const primaryButtonClassName =
  "inline-flex items-center justify-center rounded-full bg-stone-900 px-4 py-2.5 text-sm font-medium text-stone-50 shadow-sm transition hover:bg-stone-800 focus:outline-none focus:ring-2 focus:ring-stone-300 disabled:opacity-50";

export const secondaryButtonClassName =
  "inline-flex items-center justify-center rounded-full border border-stone-200 bg-white px-4 py-2.5 text-sm font-medium text-stone-700 shadow-sm transition hover:border-stone-300 hover:bg-stone-50 focus:outline-none focus:ring-2 focus:ring-stone-200 disabled:opacity-50";

export const ghostButtonClassName =
  "inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-medium text-stone-500 transition hover:bg-stone-100 hover:text-stone-900";

export const iconButtonClassName =
  "rounded-full p-2 text-stone-400 transition hover:bg-stone-100 hover:text-stone-700 disabled:opacity-50";

export const inputClassName =
  "w-full rounded-2xl border border-stone-200 bg-white px-3.5 py-2.5 text-sm text-stone-900 placeholder-stone-400 shadow-sm outline-none transition focus:border-stone-400 focus:ring-2 focus:ring-stone-200";

export const textareaClassName = `${inputClassName} min-h-[120px]`;

export const selectClassName = inputClassName;

export const smallLabelClassName =
  "mb-1.5 block text-xs font-medium uppercase tracking-[0.18em] text-stone-500";

export const eyebrowClassName =
  "inline-flex items-center gap-2 rounded-full bg-stone-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-500";

export const chipClassName =
  "inline-flex items-center gap-1 rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-600 ring-1 ring-inset ring-stone-200";

export const tagClassName =
  "inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-800 ring-1 ring-inset ring-amber-200";

export const timelineRailClassName =
  "absolute left-[5px] top-0 h-full w-px bg-stone-200";

export const timelineDotClassName =
  "absolute left-0 top-6 h-[11px] w-[11px] rounded-full border-2 border-sky-500 bg-[#f3efe6]";

export const emptyStateClassName =
  "flex min-h-[280px] flex-col items-center justify-center rounded-[22px] border border-dashed border-stone-300 bg-white/70 px-6 py-12 text-center shadow-sm";

export const modalBackdropClassName =
  "fixed inset-3 z-50 flex items-center justify-center overflow-hidden rounded-[28px] bg-stone-950/42 px-4 backdrop-blur-md sm:inset-4 sm:rounded-[28px]";

export const modalPanelClassName =
  "w-full max-w-md rounded-[28px] border border-stone-200 bg-[linear-gradient(180deg,#fffdf8_0%,#f6f0e7_100%)] p-6 shadow-[0_24px_80px_rgba(28,25,23,0.28)]";

export const skeletonClassName =
  "animate-pulse rounded-2xl bg-[linear-gradient(90deg,rgba(231,229,228,0.9),rgba(245,245,244,1),rgba(231,229,228,0.9))] bg-[length:200%_100%]";

export const statusColorClassNames: Record<string, string> = {
  reading: "bg-sky-100 text-sky-700 ring-1 ring-inset ring-sky-200",
  completed:
    "bg-emerald-100 text-emerald-700 ring-1 ring-inset ring-emerald-200",
  dropped: "bg-rose-100 text-rose-700 ring-1 ring-inset ring-rose-200",
  on_hold: "bg-amber-100 text-amber-700 ring-1 ring-inset ring-amber-200",
};

export const roleColorClassNames: Record<string, string> = {
  protagonist: "bg-sky-100 text-sky-700 ring-1 ring-inset ring-sky-200",
  antagonist: "bg-rose-100 text-rose-700 ring-1 ring-inset ring-rose-200",
  supporting: "bg-violet-100 text-violet-700 ring-1 ring-inset ring-violet-200",
  minor: "bg-stone-100 text-stone-600 ring-1 ring-inset ring-stone-200",
};

export function DashboardPage({
  children,
  maxWidth = "max-w-6xl",
}: {
  children: ReactNode;
  maxWidth?: string;
}) {
  return (
    <main className={pageRootClassName}>
      <div className={`mx-auto ${maxWidth}`}>
        <section className={shellClassName}>
          <div className={innerShellClassName}>{children}</div>
        </section>
      </div>
    </main>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="space-y-2">
        {eyebrow ? <div className={eyebrowClassName}>{eyebrow}</div> : null}
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-[-0.04em] text-stone-950 sm:text-4xl">
            {title}
          </h1>
          {description ? (
            <ExpandableDescription>{description}</ExpandableDescription>
          ) : null}
        </div>
      </div>
      {action ? (
        <div className="flex justify-start lg:justify-end">{action}</div>
      ) : null}
    </div>
  );
}

export function formatDisplayDate(value: string | null | undefined) {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function toDateTimeLocalInputValue(value: string | null | undefined) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const pad = (part: number) => String(part).padStart(2, "0");

  // datetime-local expects local wall-clock time without any timezone suffix.
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function normalizeDateTimeLocalToISOString(value: string) {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  // Persist as ISO so the API stores a real timestamp instead of a date-only string.
  return date.toISOString();
}

export function LoadingBar({ className }: { className: string }) {
  return <div className={`${skeletonClassName} ${className}`} />;
}

export function ConfirmDialog({
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
  if (!open) return null;

  return (
    <div className={`${modalBackdropClassName} z-60`}>
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
    </div>
  );
}

export function Snackbar({
  open,
  message,
  onClose,
  closeLabel = "OK",
  tone = "success",
}: {
  open: boolean;
  message: ReactNode;
  onClose: () => void;
  closeLabel?: ReactNode;
  tone?: "success" | "error";
}) {
  if (!open) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-70 flex justify-center px-4">
      <div
        className={`pointer-events-auto flex min-w-70 max-w-md items-center justify-between gap-3 rounded-2xl border px-4 py-3 shadow-[0_16px_40px_rgba(28,25,23,0.18)] ${
          tone === "success"
            ? "border-emerald-200 bg-emerald-50 text-emerald-900"
            : "border-rose-200 bg-rose-50 text-rose-900"
        }`}>
        <p className="text-sm font-medium">{message}</p>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full px-2 py-1 text-xs font-semibold text-current/70 transition hover:bg-black/5 hover:text-current">
          {closeLabel}
        </button>
      </div>
    </div>
  );
}

export function LoadingCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className={cardClassName}>
      <div className="space-y-3">
        {Array.from({ length: lines }).map((_, index) => (
          <LoadingBar
            key={index}
            className={
              index === 0
                ? "h-4 w-28"
                : index === lines - 1
                  ? "h-4 w-2/3"
                  : "h-4 w-full"
            }
          />
        ))}
      </div>
    </div>
  );
}

export function PageLoadingState({
  maxWidth = "max-w-6xl",
  backLinkWidth,
  headerWidths = ["h-7 w-24", "h-12 w-80", "h-4 w-full max-w-2xl"],
  sidebar = false,
  sidebarLines = ["h-4 w-28", "h-24 w-full", "h-20 w-full"],
  contentCards = [3, 4, 4],
  contentClassName = "space-y-4",
  gridClassName = "grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]",
}: {
  maxWidth?: string;
  backLinkWidth?: string;
  headerWidths?: string[];
  sidebar?: boolean;
  sidebarLines?: string[];
  contentCards?: number[];
  contentClassName?: string;
  gridClassName?: string;
}) {
  const header = (
    <div className="space-y-4">
      {headerWidths.map((width, index) => (
        <LoadingBar key={index} className={width} />
      ))}
    </div>
  );

  const content = (
    <div className={contentClassName}>
      {contentCards.map((lines, index) => (
        <LoadingCard key={index} lines={lines} />
      ))}
    </div>
  );

  return (
    <DashboardPage maxWidth={maxWidth}>
      <div className="space-y-5">
        {backLinkWidth ? <LoadingBar className={backLinkWidth} /> : null}
        {header}

        {sidebar ? (
          <div className={gridClassName}>
            <aside className={mutedCardClassName}>
              <div className="space-y-4">
                {sidebarLines.map((width, index) => (
                  <LoadingBar key={index} className={width} />
                ))}
              </div>
            </aside>
            {content}
          </div>
        ) : (
          content
        )}
      </div>
    </DashboardPage>
  );
}
