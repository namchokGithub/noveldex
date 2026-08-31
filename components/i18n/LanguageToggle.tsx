'use client'

import { secondaryButtonClassName } from '@/app/novels/ui'

import { useI18n } from './I18nProvider'

export default function LanguageToggle() {
  const { language, setLanguage, t } = useI18n()

  return (
    <div className="flex items-center justify-end gap-1 border-b border-stone-200 bg-white/85 px-4 py-2 backdrop-blur sm:fixed sm:right-4 sm:top-4 sm:z-40 sm:justify-start sm:rounded-full sm:border sm:border-stone-200 sm:border-b-0 sm:p-1 sm:shadow-lg">
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
