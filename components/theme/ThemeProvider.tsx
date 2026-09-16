"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type ThemePreference = "system" | "light" | "dark";

const STORAGE_KEY = "novelndex-theme";
const ThemeContext = createContext<{
  theme: ThemePreference;
  setTheme: (theme: ThemePreference) => void;
} | null>(null);

function resolvedTheme(theme: ThemePreference, prefersDark: boolean) {
  return theme === "system" ? (prefersDark ? "dark" : "light") : theme;
}

function applyTheme(theme: ThemePreference, prefersDark: boolean) {
  document.documentElement.dataset.theme = resolvedTheme(theme, prefersDark);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemePreference>("system");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(STORAGE_KEY);
    } catch {}
    const initialTheme: ThemePreference =
      stored === "light" || stored === "dark" || stored === "system"
        ? stored
        : "system";

    const frame = window.requestAnimationFrame(() => {
      setThemeState(initialTheme);
      setHydrated(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    applyTheme(theme, media.matches);
    const handleChange = (event: MediaQueryListEvent) => {
      if (theme === "system") applyTheme("system", event.matches);
    };
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, [hydrated, theme]);

  const value = useMemo(
    () => ({
      theme,
      setTheme: (nextTheme: ThemePreference) => {
        setThemeState(nextTheme);
        try {
          window.localStorage.setItem(STORAGE_KEY, nextTheme);
        } catch {}
        applyTheme(
          nextTheme,
          window.matchMedia("(prefers-color-scheme: dark)").matches,
        );
      },
    }),
    [theme],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
}
