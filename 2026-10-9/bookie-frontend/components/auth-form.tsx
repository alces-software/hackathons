"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  mode: "login" | "signup";
  next?: string;
};

const inputClass =
  "mt-1.5 w-full border border-rule bg-paper-2 px-3 py-2 font-mono text-sm " +
  "focus:border-ink focus:bg-paper focus:outline-none";

export function AuthForm({ mode, next }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode,
          username: fd.get("username"),
          password: fd.get("password"),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Something went sideways — try again.");
        return;
      }
      router.push(next ?? "/me");
      router.refresh();
    } catch {
      setError("Could not reach the ledger office.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-5 text-sm">
      <label className="block">
        <span className="sc text-muted">Name on the book</span>
        <input
          name="username"
          required
          minLength={4}
          maxLength={25}
          autoComplete="username"
          spellCheck={false}
          className={inputClass}
        />
        <span className="mt-1 block text-xs text-muted">
          4 to 25 characters, as it will appear in the ledger.
        </span>
      </label>
      <label className="block">
        <span className="sc text-muted">Password</span>
        <input
          name="password"
          type="password"
          required
          minLength={4}
          maxLength={30}
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          className={inputClass}
        />
        {mode === "signup" && (
          <span className="mt-1 block text-xs text-muted">
            4 to 30 characters. The core only checks it you delete your
            account, so pick something memorable for that occasion.
          </span>
        )}
      </label>

      {error && (
        <p className="border-l-2 border-debit pl-3 text-sm text-debit">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="sc w-full border border-ink bg-ink px-4 py-2.5 text-paper transition-colors hover:bg-transparent hover:text-ink disabled:opacity-50"
      >
        {busy ? "Entering…" : mode === "signup" ? "Open the account" : "Sign in"}
      </button>
    </form>
  );
}