import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser, ApiError, type User } from "@/lib/api";
import { getSession } from "@/lib/session";
import { fmtAmount } from "@/lib/format";
import { BankForm } from "@/components/bank-form";

export const metadata = { title: "The bank" };

export default async function BankPage() {
  const me = await getSession();
  if (!me) {
    redirect("/login?next=/bank");
  }

  let standing: User | null = null;
  try {
    standing = await getUser(me);
  } catch (e) {
    if (!(e instanceof ApiError)) throw e;
    standing = null;
  }

  const debt = standing?.debt ?? null;

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="font-serif text-3xl">The bank</h1>
      <p className="sc mt-1 text-muted">loans against your name</p>

      {debt === null ? (
        <p className="mt-6 text-sm text-muted">
          Your debt couldn’t be read just now — the forms below still work.
        </p>
      ) : debt > 0 ? (
        <p className="mt-6 text-sm">
          You owe the bank{" "}
          <span className="amt font-medium text-debit">{fmtAmount(debt)}</span>.
        </p>
      ) : (
        <p className="mt-6 text-sm text-muted">You owe the bank nothing.</p>
      )}

      <div className="mt-10 grid gap-x-10 gap-y-10 sm:grid-cols-2">
        <section>
          <h2 className="sc">Take a loan</h2>
          <p className="mt-1 text-xs text-muted">
            Money in now; a mark against your name in the book.
          </p>
          <BankForm action="loan" />
        </section>
        <section>
          <h2 className="sc">Repay</h2>
          <p className="mt-1 text-xs text-muted">
            Money back; the mark shrinks the same way it grew.
          </p>
          <BankForm action="repay" />
        </section>
      </div>

      <p className="mt-10 border-t border-rule pt-4 text-xs leading-relaxed text-muted">
        The core asks for your password to act on your account, so it is given
        fresh each time and never kept here. Loans and repayments land in the{" "}
        <Link href="/ledger" className="underline underline-offset-4">
          ledger
        </Link>{" "}
        like any other entry.
      </p>
    </div>
  );
}