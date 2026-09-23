"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { ChevronUp } from "lucide-react";

export default function BackToTopButton({ anchorId }: { anchorId: string }) {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const anchor = document.getElementById(anchorId);
    if (!anchor) return;

    const observer = new IntersectionObserver(([entry]) => {
      setVisible(!entry.isIntersecting);
    });
    observer.observe(anchor);

    return () => observer.disconnect();
  }, [anchorId]);

  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className="fixed bottom-5 right-5 z-50 inline-flex h-11 w-11 items-center justify-center rounded-full border border-stone-200 bg-white text-lg text-stone-700 shadow-lg transition hover:-translate-y-0.5 hover:border-stone-300 hover:bg-stone-50 hover:text-stone-950 focus:outline-none focus:ring-2 focus:ring-stone-300"
      aria-label={t("common.backToTop")}
      title={t("common.backToTop")}>
      <ChevronUp className="h-6 w-6" strokeWidth={2} />
    </button>
  );
}
