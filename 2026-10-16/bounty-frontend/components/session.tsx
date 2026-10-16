"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
} from "react";
import { jsonInit, wire, WireError } from "@/lib/client";

export type Clerk = { username: string; password: string };

export type SignInResult = { ok: true } | { ok: false; message: string };

// The bank asks for name and counter-sign on every piece of paperwork,
// so the register card holds both, on this device only. The card reads
// as an external store: localStorage on the client, nothing on the wire.
const STORAGE_KEY = "deadeye.clerk";

let cached: Clerk | null | undefined; // undefined until first read
const listeners = new Set<() => void>();

function readStoredClerk(): Clerk | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Clerk>;
    if (
      typeof parsed.username === "string" &&
      typeof parsed.password === "string"
    ) {
      return { username: parsed.username, password: parsed.password };
    }
  } catch {
    // Bad card on file — treat as signed out.
  }
  return null;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): Clerk | null {
  if (cached === undefined) cached = readStoredClerk();
  return cached;
}

function getServerSnapshot(): Clerk | null {
  return null;
}

function updateCard(next: Clerk | null) {
  cached = next;
  try {
    if (next) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Private mode or full disk — the card stays in hand for this visit.
  }
  for (const listener of listeners) listener();
}

/** True once hydration has happened; nothing to subscribe to. */
const neverSubscribe = () => () => {};
const alwaysClient = () => true;
const alwaysServer = () => false;

type SessionApi = {
  clerk: Clerk | null;
  ready: boolean;
  signIn: (username: string, password: string) => Promise<SignInResult>;
  signOut: () => void;
};

const SessionCtx = createContext<SessionApi | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const clerk = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const ready = useSyncExternalStore(
    neverSubscribe,
    alwaysClient,
    alwaysServer,
  );

  const signIn = useCallback<SessionApi["signIn"]>(
    async (username, password) => {
      try {
        await wire<{ message: string }>(
          "/users/login",
          jsonInit("POST", { username, password }),
        );
      } catch (error) {
        return {
          ok: false,
          message:
            error instanceof WireError
              ? error.message
              : "The counter didn't answer. Try again.",
        };
      }
      updateCard({ username, password });
      return { ok: true };
    },
    [],
  );

  const signOut = useCallback(() => {
    updateCard(null);
  }, []);

  const value = useMemo(
    () => ({ clerk, ready, signIn, signOut }),
    [clerk, ready, signIn, signOut],
  );

  return <SessionCtx.Provider value={value}>{children}</SessionCtx.Provider>;
}

export function useClerk(): SessionApi {
  const ctx = useContext(SessionCtx);
  if (!ctx) throw new Error("useClerk must live inside SessionProvider");
  return ctx;
}
