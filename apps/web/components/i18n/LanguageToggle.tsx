'use client'

import { secondaryButtonClassName } from '@/app/novels/ui'

import { useI18n } from './I18nProvider'

export default function LanguageToggle() {
  const { language, setLanguage, t } = useI18n()

  return (
    <div className="fixed right-4 top-4 z-40 flex items-center gap-1 rounded-full border border-stone-200 bg-white/85 p-1 shadow-lg backdrop-blur">
      <span className="px-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">
        {t('language.toggleLabel')}
      </span>
      <button
        type="button"
        onClick={() => setLanguage('en')}
        className={language === 'en' ? secondaryButtonClassName : 'rounded-full px-3 py-2 text-sm text-stone-500 transition hover:bg-stone-100 hover:text-stone-900'}
        aria-pressed={language === 'en'}
        aria-label={t('language.switchToEnglish')}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => setLanguage('th')}
        className={language === 'th' ? secondaryButtonClassName : 'rounded-full px-3 py-2 text-sm text-stone-500 transition hover:bg-stone-100 hover:text-stone-900'}
        aria-pressed={language === 'th'}
        aria-label={t('language.switchToThai')}
      >
        ไทย
      </button>
    </div>
  )
}
