"use client";

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { useAuth } from "@/components/auth/AuthProvider";
import { signInAdmin, signOutAdmin } from "@/libs/firebase/auth";
import {
  ghostButtonClassName,
  inputClassName,
  secondaryButtonClassName,
} from "@/app/novels/ui";

export default function SignInControl() {
  const { t } = useI18n();
  const { user, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const accountTriggerRef = useRef<HTMLButtonElement>(null);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const signInTriggerRef = useRef<HTMLButtonElement>(null);
  const signInFormRef = useRef<HTMLFormElement>(null);

  function closeAccountMenu({ restoreFocus = true } = {}) {
    setAccountOpen(false);
    if (restoreFocus)
      window.requestAnimationFrame(() => accountTriggerRef.current?.focus());
  }

  useEffect(() => {
    if (!accountOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (
        !accountMenuRef.current?.contains(event.target as Node) &&
        !accountTriggerRef.current?.contains(event.target as Node)
      )
        closeAccountMenu();
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [accountOpen]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (
        !signInFormRef.current?.contains(event.target as Node) &&
        !signInTriggerRef.current?.contains(event.target as Node)
      ) {
        setOpen(false);
        setError(null);
      }
    };
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      setError(null);
      window.requestAnimationFrame(() => signInTriggerRef.current?.focus());
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (loading) return null;

  function handleSignOut() {
    setSignOutError(null);
    void signOutAdmin()
      .then(() => closeAccountMenu({ restoreFocus: false }))
      .catch(() => {
        setSignOutError(t("auth.signOutError"));
      });
  }

  if (user) {
    const accountName =
      user.displayName?.trim() || user.email?.split("@")[0] || "Account";
    // const initial = (user.displayName || user.email || "A")
    //   .trim()
    //   .charAt(0)
    //   .toLocaleUpperCase();
    const handleAccountMenuKeyDown = (
      event: ReactKeyboardEvent<HTMLDivElement>,
    ) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeAccountMenu();
      }
    };

    return (
      <div className="relative">
        <button
          ref={accountTriggerRef}
          type="button"
          onClick={() => setAccountOpen((current) => !current)}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setAccountOpen(true);
              window.requestAnimationFrame(() =>
                accountMenuRef.current
                  ?.querySelector<HTMLButtonElement>('[role="menuitem"]')
                  ?.focus(),
              );
            }
          }}
          aria-label={accountName}
          aria-haspopup="menu"
          aria-expanded={accountOpen}
          className="inline-flex h-9 items-center gap-2 rounded-full px-1.5 pr-2.5 text-sm font-medium text-stone-600 transition hover:bg-stone-100 hover:text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400">
          {/* <span
            aria-hidden="true"
            className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-stone-200 text-xs font-semibold text-stone-700">
            {initial}
          </span> */}
          <span className="hidden max-w-28 truncate sm:inline">
            {accountName}
          </span>
          <svg
            aria-hidden="true"
            className="hidden sm:block"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2">
            <path d="m7 10 5 5 5-5" />
          </svg>
        </button>
        {accountOpen ? (
          <div
            ref={accountMenuRef}
            role="menu"
            aria-label={accountName}
            onKeyDown={handleAccountMenuKeyDown}
            className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-60 rounded-2xl border border-stone-200 bg-white p-1.5 shadow-[0_12px_28px_rgba(28,25,23,0.14)]">
            <p className="truncate px-3 py-2 text-xs text-stone-500">
              {user.email}
            </p>
            <div className="my-1 border-t border-stone-100" />
            <button
              type="button"
              role="menuitem"
              onClick={handleSignOut}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-rose-600 transition hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-200">
              {t("auth.signOut")}
            </button>
            {signOutError ? (
              <p role="alert" className="px-3 py-2 text-xs text-rose-600">
                {signOutError}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signInAdmin(email, password);
      setOpen(false);
      setEmail("");
      setPassword("");
    } catch {
      setError(t("auth.signInError"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative flex items-center gap-1.5">
      <span className="hidden text-xs font-medium text-stone-500 sm:inline">
        {t("auth.guestMode")}
      </span>
      <button
        ref={signInTriggerRef}
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-controls="sign-in-form"
        className={`${ghostButtonClassName} h-9 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400`}>
        {t("auth.signIn")}
      </button>
      {open ? (
        <form
          ref={signInFormRef}
          id="sign-in-form"
          onSubmit={(event) => void handleSubmit(event)}
          className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-[min(20rem,calc(100vw-2rem))] space-y-3 rounded-2xl border border-stone-200 bg-white p-3 shadow-[0_12px_28px_rgba(28,25,23,0.14)]">
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder={t("auth.email")}
            aria-label={t("auth.email")}
            autoComplete="email"
            className={`${inputClassName} py-2 text-sm`}
          />
          <input
            type="password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder={t("auth.password")}
            aria-label={t("auth.password")}
            autoComplete="current-password"
            className={`${inputClassName} py-2 text-sm`}
          />
          {error ? (
            <p role="alert" className="text-xs text-rose-600">
              {error}
            </p>
          ) : null}
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              disabled={submitting}
              onClick={() => {
                setOpen(false);
                setError(null);
              }}
              className={ghostButtonClassName}>
              {t("common.cancel")}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className={secondaryButtonClassName}>
              {submitting ? t("common.saving") : t("auth.signIn")}
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
