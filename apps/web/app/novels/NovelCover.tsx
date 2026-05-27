"use client";

import { useState } from "react";

type NovelCoverProps = {
  title: string;
  coverUrl?: string | null;
  alt?: string;
  className?: string;
  fallbackClassName?: string;
  titleClassName?: string;
};

function getInitials(title: string) {
  const words = title.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return "ND";
  }

  return words
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

export default function NovelCover({
  title,
  coverUrl,
  alt,
  className = "",
  fallbackClassName = "",
  titleClassName = "",
}: NovelCoverProps) {
  const [failed, setFailed] = useState(false);
  const hasCover = Boolean(coverUrl && !failed);

  if (!hasCover) {
    return (
      <div
        aria-hidden="true"
        className={`flex items-center justify-center overflow-hidden bg-stone-950 text-stone-50 ${className} ${fallbackClassName}`}>
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.14),transparent_58%)]" />
        <span
          className={`relative z-10 font-semibold tracking-[0.12em] ${titleClassName}`}>
          {getInitials(title)}
        </span>
      </div>
    );
  }

  return (
    <img
      src={coverUrl ?? undefined}
      alt={alt ?? title}
      className={className}
      onError={() => setFailed(true)}
    />
  );
}
