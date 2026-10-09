"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

export function SignOutButton() {
  const router = useRouter();
  const [pending, start] = useTransition();

  function signOut() {
    start(async () => {
      await fetch("/api/session", { method: "DELETE" });
      router.replace("/");
      router.refresh();
    });
  }

  return (
    <button
      onClick={signOut}
      disabled={pending}
      className="sc text-debit hover:underline disabled:opacity-50"
    >
      {pending ? "Closing…" : "Sign out"}
    </button>
  );
}