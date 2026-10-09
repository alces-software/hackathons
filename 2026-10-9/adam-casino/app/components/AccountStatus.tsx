"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { clearBankingCredentials, fetchBankingBalance, getStoredBankingCredentials } from "../../lib/banking";

export default function AccountStatus() {
  const [username, setUsername] = useState<string | null>(null);
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    const credentials = getStoredBankingCredentials();
    if (!credentials) return;
    setUsername(credentials.username);
    fetchBankingBalance(credentials.username).then(setBalance).catch(() => {
      clearBankingCredentials();
      setUsername(null);
    });
  }, []);

  function disconnect() {
    clearBankingCredentials();
    setUsername(null);
    setBalance(null);
  }

  if (!username) {
    return <Link href="/login" className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/15">Sign in</Link>;
  }

  return (
    <div className="flex items-center gap-3">
      <div className="hidden text-right sm:block">
        <p className="text-xs text-sky-100/55">Signed in as</p>
        <p className="text-sm font-semibold text-sky-200">{username}</p>
      </div>
      {balance !== null && <span className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-2 text-sm font-semibold text-emerald-200">{balance.toFixed(2)} moose bucks</span>}
      <button onClick={disconnect} className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/15">Disconnect</button>
    </div>
  );
}
