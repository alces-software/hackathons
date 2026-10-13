import Link from "next/link";
import { redirect } from "next/navigation";
import { getAllUsers, getFees, ApiError } from "@/lib/api";
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

  // The percent the house takes off each transfer — shown in the form so
  // nobody is surprised by what lands on the other name.
  let fee: number | null = null;
  try {
    fee = (await getFees()).userTransactionFee;
  } catch (e) {
    if (!(e instanceof ApiError)) throw e;
    fee = null;
  }

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="font-serif text-3xl">Transfers</h1>
      <p className="sc mt-1 text-muted">money between accounts</p>

      <p className="mt-6 text-sm leading-relaxed text-muted">
        Hand money to another name on the book. The amount leaves your balance,
        the house takes its cut, and the rest lands on theirs — published in
        the ledger like everything else.
      </p>

      <TransferForm recipients={recipients} fee={fee} />

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