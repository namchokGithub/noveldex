"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";

export default function ExpandableDescription({
  children,
}: {
  children: ReactNode;
}) {
  const { t } = useI18n();
  const textRef = useRef<HTMLParagraphElement | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);

  useEffect(() => {
    const element = textRef.current;
    if (!element) return;

    function measure() {
      if (!element) return;

      const wasExpanded = !element.classList.contains("line-clamp-2");
      if (wasExpanded) {
        element.classList.add("line-clamp-2");
      }

      setOverflowing(element.scrollHeight > element.clientHeight + 1);

      if (wasExpanded) {
        element.classList.remove("line-clamp-2");
      }
    }

    measure();

    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(element);

    return () => {
      resizeObserver.disconnect();
    };
  }, [children]);

  return (
    <div className="max-w-2xl">
      <p
        ref={textRef}
        className={`text-sm leading-6 text-stone-600 sm:text-base ${
          expanded ? "" : "line-clamp-2"
        }`}>
        {children}
      </p>

      {overflowing ? (
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          className="mt-2 text-sm font-medium text-stone-700 underline decoration-stone-300 underline-offset-4 transition hover:text-stone-950 hover:decoration-stone-500">
          {expanded ? t("common.showLess") : t("common.readFull")}
        </button>
      ) : null}
    </div>
  );
}
