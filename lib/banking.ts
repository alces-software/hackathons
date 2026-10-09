"use client";

import { useEffect, useState } from "react";

export type BankingCredentials = { username: string; password: string };

const credentialsKey = "alces-banking-credentials";

export function getStoredBankingCredentials(): BankingCredentials | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(credentialsKey);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as BankingCredentials;
  } catch {
    window.sessionStorage.removeItem(credentialsKey);
    return null;
  }
}

export function storeBankingCredentials(credentials: BankingCredentials) {
  window.sessionStorage.setItem(credentialsKey, JSON.stringify(credentials));
}

export function clearBankingCredentials() {
  window.sessionStorage.removeItem(credentialsKey);
}

export function useBankingBalance() {
  const [balance, setBalance] = useState(0);
  useEffect(() => {
    const credentials = getStoredBankingCredentials();
    if (!credentials) return;
    fetchBankingBalance(credentials.username).then(setBalance).catch(() => setBalance(0));
  }, []);
  return [balance, setBalance] as const;
}

export async function bankingTransfer(credentials: BankingCredentials, amount: number, direction: "stake" | "payout") {
  const response = await fetch("/api/banking/transfer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...credentials, amount, direction }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(body?.error || "Banking transfer failed.");
  }
}

export async function bankingStake(amount: number) {
  const credentials = getStoredBankingCredentials();
  if (!credentials) throw new Error("Connect a banking account before placing a bet.");
  await bankingTransfer(credentials, amount, "stake");
}

export async function bankingPayout(amount: number) {
  const credentials = getStoredBankingCredentials();
  if (!credentials) throw new Error("Connect a banking account before collecting a payout.");
  await bankingTransfer(credentials, amount, "payout");
}

export async function syncBankingBalance(setBalance: (balance: number) => void) {
  const credentials = getStoredBankingCredentials();
  if (!credentials) throw new Error("Connect a banking account before playing.");
  const balance = await fetchBankingBalance(credentials.username);
  setBalance(balance);
  return balance;
}

export async function fetchBankingBalance(username: string) {
  const response = await fetch(`/api/banking/balance?username=${encodeURIComponent(username)}`, { cache: "no-store" });
  const body = await response.json() as { balance?: string | number; error?: string };
  if (!response.ok || body.balance === undefined) throw new Error(body.error || "Could not load banking balance.");
  return Number(body.balance);
}
