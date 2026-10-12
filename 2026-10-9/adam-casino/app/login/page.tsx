"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { fetchBankingBalance, storeBankingCredentials } from "../../lib/banking";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  async function login(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    setSubmitting(true);
    try {
      const normalizedUsername = username.trim();
      const balance = await fetchBankingBalance(normalizedUsername);
      storeBankingCredentials({ username: normalizedUsername, password });
      router.push(`/?login=success&balance=${encodeURIComponent(balance.toFixed(2))}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not connect to banking account.");
      setSubmitting(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#071426] px-6 py-12 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(37,99,235,0.35),_transparent_38%),radial-gradient(circle_at_bottom_left,_rgba(14,116,144,0.22),_transparent_35%)]" />
      <section className="relative w-full max-w-md">
        <Link href="/" className="mb-8 flex items-center justify-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-400 text-3xl text-[#071426]">🫎</span>
          <span className="font-serif text-2xl font-bold">Alces Casino</span>
        </Link>
        <div className="rounded-3xl border border-sky-300/20 bg-[#0b2741]/90 p-6 shadow-2xl sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-sky-300">Player account</p>
          <h1 className="mt-2 font-serif text-3xl font-bold">Sign in to play</h1>
          <p className="mt-3 text-sm leading-6 text-sky-100/65">Connect your banking account to use your balance across every Alces Casino game.</p>
          <form onSubmit={login} className="mt-8 space-y-5">
            <div>
              <label htmlFor="banking-username" className="text-xs font-bold uppercase tracking-wider text-sky-100/65">Username</label>
              <input id="banking-username" required minLength={4} value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" className="mt-2 w-full rounded-xl border border-sky-200/20 bg-slate-900 px-4 py-3 text-white outline-none focus:border-sky-400" />
            </div>
            <div>
              <label htmlFor="banking-password" className="text-xs font-bold uppercase tracking-wider text-sky-100/65">Password</label>
              <input id="banking-password" required minLength={4} type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" className="mt-2 w-full rounded-xl border border-sky-200/20 bg-slate-900 px-4 py-3 text-white outline-none focus:border-sky-400" />
            </div>
            <button type="submit" disabled={submitting} className="w-full rounded-xl bg-sky-400 px-4 py-3 font-bold text-[#071426] transition hover:bg-sky-300 disabled:cursor-wait disabled:opacity-50">{submitting ? "Connecting..." : "Connect account"}</button>
          </form>
          {message && <p role="alert" className="mt-5 rounded-xl border border-rose-300/20 bg-rose-500/10 p-3 text-sm text-rose-200">{message}</p>}
          <p className="mt-6 text-center text-xs text-sky-100/45">Your session stays in this browser until you disconnect.</p>
        </div>
        <Link href="/" className="mt-6 block text-center text-sm text-sky-300 hover:text-white">Back to lodge</Link>
      </section>
    </main>
  );
}
