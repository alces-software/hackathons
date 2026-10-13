import Link from "next/link";
import { redirect } from "next/navigation";
import { getAllUsers, ApiError } from "@/lib/api";
import { getSession } from "@/lib/session";
import { TransferForm } from "@/components/transfer-form";

export const metadata = { title: "Transfers" };

export default async function TransferPage() {
  const me = await getSession();
  if (!me) {
    redirect("/login?next=/transfer");
  }

  // Recipients come from the user list, your own name left out.
  let recipients: string[] | null = null;
  try {
    recipients = (await getAllUsers())
      .map((u) => u.username)
      .filter((name) => name !== me);
  } catch (e) {
    if (!(e instanceof ApiError)) throw e;
    recipients = null;
  }

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="font-serif text-3xl">Transfers</h1>
      <p className="sc mt-1 text-muted">money between accounts</p>

      <p className="mt-6 text-sm leading-relaxed text-muted">
        Hand money to another name on the book. The amount leaves your balance
        and lands in theirs — two entries, published in the ledger like
        everything else.
      </p>

      <TransferForm recipients={recipients} />

      <p className="mt-8 border-t border-rule pt-4 text-xs leading-relaxed text-muted">
        The core asks for your password to move your money, so it is given
        fresh each time and kept by nobody here. The result shows up in the{" "}
        <Link href="/ledger" className="underline underline-offset-4">
          ledger
        </Link>{" "}
        straight away.
      </p>
    </div>
  );
}