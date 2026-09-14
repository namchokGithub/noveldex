"use client";

import { useState } from "react";
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

  if (loading) return null;

  function handleSignOut() {
    setSignOutError(null);
    void signOutAdmin().catch(() => {
      setSignOutError(t("auth.signOutError"));
    });
  }

  if (user) {
    return (
      <div className="flex items-center gap-2">
        <span className="hidden text-xs text-stone-500 sm:inline">
          {user.email}
        </span>
        <button
          type="button"
          onClick={handleSignOut}
          className={ghostButtonClassName}>
          {t("auth.signOut")}
        </button>
        {signOutError ? (
          <span role="alert" className="text-xs text-rose-600">
            {signOutError}
          </span>
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

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={ghostButtonClassName}>
        {t("auth.signIn")}
      </button>
    );
  }

  return (
    <form
      onSubmit={(event) => void handleSubmit(event)}
      className="flex items-center gap-1.5">
      <input
        type="email"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder={t("auth.email")}
        aria-label={t("auth.email")}
        autoComplete="email"
        className={`${inputClassName} w-32 py-1.5 text-sm`}
      />
      <input
        type="password"
        required
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        placeholder={t("auth.password")}
        aria-label={t("auth.password")}
        autoComplete="current-password"
        className={`${inputClassName} w-28 py-1.5 text-sm`}
      />
      <button
        type="submit"
        disabled={submitting}
        className={secondaryButtonClassName}>
        {submitting ? t("common.saving") : t("auth.signIn")}
      </button>
      <button
        type="button"
        onClick={() => {
          setOpen(false);
          setError(null);
        }}
        className={ghostButtonClassName}>
        {t("common.cancel")}
      </button>
      {error ? (
        <span role="alert" className="text-xs text-rose-600">
          {error}
        </span>
      ) : null}
    </form>
  );
}
