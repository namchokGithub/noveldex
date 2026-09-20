"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import {
  readRecentNovelPages,
  recentNovelPageStorageKey,
  recordRecentNovelPage,
} from "@/libs/recentNovelPages";

export default function RecentNovelPageTracker({
  novelId,
  label,
}: {
  novelId: string;
  label: string;
}) {
  const pathname = usePathname();

  useEffect(() => {
    const key = recentNovelPageStorageKey(novelId);
    const next = recordRecentNovelPage(
      readRecentNovelPages(window.localStorage.getItem(key)),
      { href: pathname, label },
      Date.now(),
    );
    window.localStorage.setItem(key, JSON.stringify(next));
  }, [label, novelId, pathname]);

  return null;
}
