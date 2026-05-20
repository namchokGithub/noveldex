import type { ReactNode } from 'react'

export const pageRootClassName =
  'min-h-screen bg-[linear-gradient(180deg,#f8f6f0_0%,#f3efe6_52%,#ece7db_100%)] px-4 py-6 text-stone-900 sm:px-6 sm:py-8'

export const shellClassName =
  'rounded-[28px] border border-white/70 bg-white/80 p-4 shadow-[0_20px_80px_rgba(120,108,84,0.12)] backdrop-blur sm:p-6'

export const innerShellClassName =
  'flex flex-col gap-5 rounded-[24px] border border-stone-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(245,240,232,0.92))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] sm:p-5'

export const cardClassName =
  'rounded-[22px] border border-stone-200 bg-white/80 p-5 shadow-[0_12px_32px_rgba(120,108,84,0.10)]'

export const mutedCardClassName =
  'rounded-[22px] border border-stone-200 bg-stone-50/90 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]'

export const listClassName = 'overflow-hidden rounded-[22px] border border-stone-200 bg-white/80 shadow-sm'

export const listRowClassName =
  'flex items-center justify-between gap-4 px-4 py-4 transition hover:bg-stone-50/90'

export const backLinkClassName =
  'inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white/80 px-3 py-1.5 text-sm text-stone-600 shadow-sm transition hover:border-stone-300 hover:text-stone-900'

export const primaryButtonClassName =
  'inline-flex items-center justify-center rounded-full bg-stone-900 px-4 py-2.5 text-sm font-medium text-stone-50 shadow-sm transition hover:bg-stone-800 focus:outline-none focus:ring-2 focus:ring-stone-300 disabled:opacity-50'

export const secondaryButtonClassName =
  'inline-flex items-center justify-center rounded-full border border-stone-200 bg-white px-4 py-2.5 text-sm font-medium text-stone-700 shadow-sm transition hover:border-stone-300 hover:bg-stone-50 focus:outline-none focus:ring-2 focus:ring-stone-200 disabled:opacity-50'

export const ghostButtonClassName =
  'inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-medium text-stone-500 transition hover:bg-stone-100 hover:text-stone-900'

export const iconButtonClassName =
  'rounded-full p-2 text-stone-400 transition hover:bg-stone-100 hover:text-stone-700 disabled:opacity-50'

export const inputClassName =
  'w-full rounded-2xl border border-stone-200 bg-white px-3.5 py-2.5 text-sm text-stone-900 placeholder-stone-400 shadow-sm outline-none transition focus:border-stone-400 focus:ring-2 focus:ring-stone-200'

export const textareaClassName = `${inputClassName} min-h-[120px]`

export const selectClassName = inputClassName

export const smallLabelClassName =
  'mb-1.5 block text-xs font-medium uppercase tracking-[0.18em] text-stone-500'

export const eyebrowClassName =
  'inline-flex items-center gap-2 rounded-full bg-stone-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-500'

export const chipClassName =
  'inline-flex items-center gap-1 rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-600 ring-1 ring-inset ring-stone-200'

export const tagClassName =
  'inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-800 ring-1 ring-inset ring-amber-200'

export const timelineRailClassName = 'absolute left-[5px] top-0 h-full w-px bg-stone-200'

export const timelineDotClassName =
  'absolute left-0 top-6 h-[11px] w-[11px] rounded-full border-2 border-sky-500 bg-[#f3efe6]'

export const emptyStateClassName =
  'flex min-h-[280px] flex-col items-center justify-center rounded-[22px] border border-dashed border-stone-300 bg-white/70 px-6 py-12 text-center shadow-sm'

export const modalBackdropClassName =
  'fixed inset-0 z-50 flex items-center justify-center bg-stone-950/55 px-4 backdrop-blur-sm'

export const modalPanelClassName =
  'w-full max-w-md rounded-[28px] border border-stone-200 bg-[linear-gradient(180deg,#fffdf8_0%,#f6f0e7_100%)] p-6 shadow-[0_24px_80px_rgba(28,25,23,0.28)]'

export const statusColorClassNames: Record<string, string> = {
  reading: 'bg-sky-100 text-sky-700 ring-1 ring-inset ring-sky-200',
  completed: 'bg-emerald-100 text-emerald-700 ring-1 ring-inset ring-emerald-200',
  dropped: 'bg-rose-100 text-rose-700 ring-1 ring-inset ring-rose-200',
  on_hold: 'bg-amber-100 text-amber-700 ring-1 ring-inset ring-amber-200',
}

export const roleColorClassNames: Record<string, string> = {
  protagonist: 'bg-sky-100 text-sky-700 ring-1 ring-inset ring-sky-200',
  antagonist: 'bg-rose-100 text-rose-700 ring-1 ring-inset ring-rose-200',
  supporting: 'bg-violet-100 text-violet-700 ring-1 ring-inset ring-violet-200',
  minor: 'bg-stone-100 text-stone-600 ring-1 ring-inset ring-stone-200',
}

export function DashboardPage({
  children,
  maxWidth = 'max-w-6xl',
}: {
  children: ReactNode
  maxWidth?: string
}) {
  return (
    <main className={pageRootClassName}>
      <div className={`mx-auto ${maxWidth}`}>
        <section className={shellClassName}>
          <div className={innerShellClassName}>{children}</div>
        </section>
      </div>
    </main>
  )
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string
  title: string
  description?: string
  action?: ReactNode
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
            <p className="max-w-2xl text-sm leading-6 text-stone-600 sm:text-base">{description}</p>
          ) : null}
        </div>
      </div>
      {action ? <div className="flex justify-start lg:justify-end">{action}</div> : null}
    </div>
  )
}

export function formatDisplayDate(value: string | null | undefined) {
  if (!value) return null

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}
