"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useClerk } from "@/components/session";
import { WireLoading } from "@/components/wire-note";

export function SignIn() {
  const { clerk, ready, signIn, signOut } = useClerk();
  const router = useRouter();

  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [welcomed, setWelcomed] = useState<string | null>(null);

  if (!ready) return <WireLoading />;

  if (welcomed) {
    // Return to where the user came from, if it's a safe local path.
    const then = new URLSearchParams(window.location.search).get("then");
    const target =
      typeof then === "string" && then.startsWith("/") && !then.startsWith("//")
        ? then
        : "/";
    window.setTimeout(() => router.replace(target), 900);
    return (
      <main className="px-4 pb-24 sm:px-6">
        <div className="mx-auto max-w-xl border border-ink px-6 py-10 text-center">
          <span className="stamp rotate-[-2deg] text-bill">Signed in</span>
          <p className="font-display mt-5 text-[2rem] font-semibold uppercase leading-tight tracking-[0.06em]">
            Welcome, {welcomed}
          </p>
          <p className="mt-3 text-[0.95rem] text-ink-soft">
            One moment — taking you back.
          </p>
        </div>
      </main>
    );
  }

  if (clerk) {
    return (
      <main className="px-4 pb-24 sm:px-6">
        <div className="mx-auto max-w-xl border border-ink px-6 py-10 text-center">
          <p className="font-display text-[2rem] font-semibold uppercase leading-tight tracking-[0.06em]">
            Already signed in
          </p>
          <p className="mt-3 text-[0.95rem] text-ink-soft">
            You’re signed in as{" "}
            <span className="font-bold text-ink">{clerk.username}</span>. Sign
            out to switch accounts.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Link href="/" className="btn">
              Back to the board
            </Link>
            <button type="button" className="btn-ghost" onClick={signOut}>
              Sign out
            </button>
          </div>
        </div>
      </main>
    );
  }

  async function present(event: React.FormEvent) {
    event.preventDefault();

    const username = name.trim();
    if (!username || !password) {
      setNote("Enter both your username and password.");
      return;
    }

    setNote(null);
    setPending(true);
    const result = await signIn(username, password);
    setPending(false);

    if (result.ok) {
      setName("");
      setPassword("");
      setWelcomed(username);
      return;
    }
    setNote(result.message);
  }

  return (
    <main className="px-4 pb-24 sm:px-6">
      <form
        onSubmit={(event) => {
          void present(event);
        }}
        className="mx-auto max-w-md border border-ink bg-paper px-6 py-8 sm:px-9"
      >
        <div className="flex items-baseline justify-between gap-4 border-b-2 border-ink pb-3">
          <p className="font-display text-[1.8rem] font-semibold leading-none tracking-[0.16em]">
            FORM B-1
          </p>
          <p className="label">Sign in</p>
        </div>

        <div className="mt-7">
          <label className="label" htmlFor="register-name">
            Username
          </label>
          <input
            id="register-name"
            className="field mt-1"
            autoComplete="username"
            spellCheck={false}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>

        <div className="mt-6">
          <label className="label" htmlFor="register-password">
            Password
          </label>
          <input
            id="register-password"
            type="password"
            className="field mt-1"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>

        {note && (
          <p
            role="alert"
            className="mt-6 border border-oxblood px-4 py-3 text-[0.85rem]"
          >
            {note}
          </p>
        )}

        <button type="submit" className="btn mt-8 w-full" disabled={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </button>
        <p className="mt-3 text-center text-[0.72rem] uppercase tracking-[0.1em] text-ink-soft">
          Your sign-in is kept on this device only
        </p>
      </form>
    </main>
  );
}