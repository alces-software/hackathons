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

  // The percent the house takes off each transfer — printed on the docket so
  // nobody is surprised by what lands on the other name.
  let fee: number | null = null;
  try {
    const raw = (await getFees()).userTransactionFee;
    fee = Number.isFinite(raw) ? raw : null;
  } catch (e) {
    if (!(e instanceof ApiError)) throw e;
    fee = null;
  }

  return (
    <div className="mx-auto max-w-xl">
      <div className="text-center">
        <p className="sc text-muted">form t-3 · rev. 11 · keep this stub</p>
        <h1 className="mt-1 font-serif text-4xl">The transfer docket</h1>
      </div>
      <p className="mx-auto mt-3 max-w-md text-center text-sm leading-relaxed text-muted">
        One name pays. Another name is paid, minus the house’s cut. Every line
        of it goes into the{" "}
        <Link href="/ledger" className="underline underline-offset-4">
          ledger
        </Link>{" "}
        where anyone can read it.
      </p>

      <TransferForm recipients={recipients} fee={fee} />

      <p className="mt-6 border-t border-dashed border-rule pt-4 text-xs leading-relaxed text-muted">
        Nothing here is reversible, and the book is public — your side of every
        docket also shows on{" "}
        <Link href="/me" className="underline underline-offset-4">
          your account
        </Link>
        . If you meant to keep the money, the office respectfully suggests not
        filing this form.
      </p>
    </div>
  );
}