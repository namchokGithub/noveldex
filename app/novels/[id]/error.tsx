"use client";

import { useI18n } from "@/components/i18n/I18nProvider";
import { cardClassName, primaryButtonClassName } from "../ui";

export default function NovelError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useI18n();
  void error;

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f8f6f0_0%,#f3efe6_52%,#ece7db_100%)] px-4 py-6 text-stone-900 sm:px-6 sm:py-8">
      <section className="mx-auto max-w-lg">
        <div className={cardClassName} role="alert">
          <h1 className="text-xl font-semibold text-stone-950">{t("error.loadTitle")}</h1>
          <p className="mt-2 text-sm text-stone-600">{t("error.loadBody")}</p>
          <button type="button" onClick={reset} className={`${primaryButtonClassName} mt-5`}>
            {t("error.retry")}
          </button>
        </div>
      </section>
    </main>
  );
}
