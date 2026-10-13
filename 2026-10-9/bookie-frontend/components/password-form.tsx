"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const inputClass =
  "mt-1.5 w-full border border-rule bg-paper px-3 py-2 font-mono text-sm " +
  "focus:border-ink focus:bg-paper focus:outline-none";

const buttonClass =
  "sc w-full border border-ink bg-ink px-4 py-2.5 text-paper transition-colors " +
  "hover:bg-transparent hover:text-ink disabled:opacity-50";

export function PasswordForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noted, setNoted] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    const form = e.currentTarget;
    e.preventDefault();
    setError(null);
    setNoted(null);
    setBusy(true);
    const fd = new FormData(form);
    if (fd.get("newPassword") !== fd.get("confirm")) {
      setError("The new passwords don’t match.");
      setBusy(false);
      return;
    }
    try {
      const res = await fetch("/api/password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          password: fd.get("password"),
          newPassword: fd.get("newPassword"),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          data.error ?? "The core didn’t answer as expected — try again.",
        );
        return;
      }
      form.reset();
      setNoted("The new password is set.");
      router.refresh();
    } catch {
      setError("Could not reach the ledger office.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-4 space-y-4 text-sm">
      <label className="block">
        <span className="sc text-muted">Current password</span>
        <input
          name="password"
          type="password"
          required
          minLength={4}
          maxLength={30}
          autoComplete="current-password"
          className={inputClass}
        />
      </label>
      <label className="block">
        <span className="sc text-muted">New password</span>
        <input
          name="newPassword"
          type="password"
          required
          minLength={4}
          maxLength={30}
          autoComplete="new-password"
          className={inputClass}
        />
      </label>
      <label className="block">
        <span className="sc text-muted">Again, to be sure</span>
        <input
          name="confirm"
          type="password"
          required
          autoComplete="new-password"
          className={inputClass}
        />
      </label>

      {error && (
        <p className="border-l-2 border-debit pl-3 text-sm text-debit">{error}</p>
      )}
      {noted && (
        <p className="border-l-2 border-credit pl-3 text-sm text-credit">
          {noted}
        </p>
      )}

      <button type="submit" disabled={busy} className={buttonClass}>
        {busy ? "Filing…" : "Set the new password"}
      </button>
    </form>
  );
}