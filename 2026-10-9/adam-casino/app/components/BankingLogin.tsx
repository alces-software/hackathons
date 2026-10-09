"use client";

import { FormEvent, useEffect, useState } from "react";
import { clearBankingCredentials, fetchBankingBalance, getStoredBankingCredentials, storeBankingCredentials } from "../../lib/banking";

export default function BankingLogin() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [balance, setBalance] = useState<number | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const credentials = getStoredBankingCredentials();
    if (!credentials) return;
    setUsername(credentials.username);
    fetchBankingBalance(credentials.username).then(setBalance).catch(() => clearBankingCredentials());
  }, []);

  async function login(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    try {
      const nextBalance = await fetchBankingBalance(username.trim());
      storeBankingCredentials({ username: username.trim(), password });
      setBalance(nextBalance);
      setMessage("Banking account connected.");
      setPassword("");
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not connect to banking account.");
    }
  }

  function logout() {
    clearBankingCredentials();
    setUsername("");
    setPassword("");
    setBalance(null);
    setMessage("Banking account disconnected.");
  }

  return (
    <div className="relative z-20 border-b border-white/10 bg-[#071426]/80 px-6 py-3 text-xs text-sky-100/75">
      <form onSubmit={login} className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 lg:px-4">
        <span className="mr-2 font-bold uppercase tracking-wider text-sky-300">Banking account</span>
        <input aria-label="Banking username" placeholder="Username" value={username} onChange={(event) => setUsername(event.target.value)} className="w-32 rounded-lg border border-sky-200/20 bg-slate-900 px-2 py-1.5 text-white outline-none focus:border-sky-400" />
        <input aria-label="Banking password" type="password" placeholder="Password" value={password} onChange={(event) => setPassword(event.target.value)} className="w-32 rounded-lg border border-sky-200/20 bg-slate-900 px-2 py-1.5 text-white outline-none focus:border-sky-400" />
        <button type="submit" className="rounded-lg bg-sky-400 px-3 py-1.5 font-bold text-[#071426] hover:bg-sky-300">Connect</button>
        {balance !== null && <><span className="ml-2 text-emerald-300">{balance.toFixed(2)} moose bucks</span><button type="button" onClick={logout} className="text-sky-100/55 hover:text-white">Disconnect</button></>}
        {message && <span role="status" className="basis-full text-sky-100/55 lg:basis-auto">{message}</span>}
      </form>
    </div>
  );
}
