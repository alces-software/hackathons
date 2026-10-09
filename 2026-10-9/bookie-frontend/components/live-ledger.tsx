"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL!;

// A change anywhere in the core re-renders the server components around this
// placeholder, so the ledger keeps telling the truth without a manual reload.

export function LiveLedger() {
  const router = useRouter();

  useEffect(() => {
    let ws: WebSocket | null = null;
    let disposed = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let debounce: ReturnType<typeof setTimeout> | undefined;
    let attempt = 0;

    const connect = () => {
      ws = new WebSocket(WS_URL);

      ws.onopen = () => {
        attempt = 0;
        router.refresh();
      };

      // Events can arrive in bursts (a transfer writes two entries); rerender
      // once per quiet 300ms rather than once per message.
      ws.onmessage = () => {
        clearTimeout(debounce);
        debounce = setTimeout(() => router.refresh(), 300);
      };

      ws.onclose = () => {
        if (disposed) return;
        const wait = Math.min(30_000, 1_000 * 2 ** attempt++);
        retry = setTimeout(connect, wait);
      };
    };
    connect();

    return () => {
      disposed = true;
      clearTimeout(retry);
      clearTimeout(debounce);
      ws?.close();
    };
  }, [router]);

  return null;
}