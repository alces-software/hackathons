import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser, ApiError, type User } from "@/lib/api";
import { getSession } from "@/lib/session";
import { fmtAmount } from "@/lib/format";
import { BankForm } from "@/components/bank-form";

export const metadata = { title: "The bank" };

function debtLine(debt: string | null) {
  if (debt === null) {
    return (
      <p className="mt-5 text-center text-sm text-muted">
        Your debt couldn’t be read just now — the forms below still work.
      </p>
    );
  }
  if (Number(debt) > 0) {
    return (
      <p className="mt-5 text-center text-sm">
        You owe the bank{" "}
        <span className="amt font-medium text-debit">{debt}</span>.
      </p>
    );
  }
  return (
    <p className="mt-5 text-center text-sm text-muted">
      You owe the bank nothing. The office finds this almost suspicious.
    </p>
  );
}

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

  const debt =
    standing === null ? null : fmtAmount(standing.debt);

  return (
    <div>
      <div className="text-center">
        <p className="sc text-muted">the bank · open while the lights are on</p>
        <h1 className="mt-1 font-serif text-4xl">The bank</h1>
      </div>

      {debtLine(debt)}

      <div className="mt-10 grid gap-x-8 gap-y-8 sm:grid-cols-2">
        <section className="sheet p-5 sm:p-6">
          <div className="border-b border-dashed border-rule pb-3 text-center">
            <p className="sc">Loan deed</p>
            <p className="mt-1 font-mono text-[0.65rem] text-muted">
              form l-4 · money in now, owed back by the book
            </p>
          </div>
          <BankForm action="loan" />
        </section>
        <section className="sheet p-5 sm:p-6">
          <div className="border-b border-dashed border-rule pb-3 text-center">
            <p className="sc">Payment slip</p>
            <p className="mt-1 font-mono text-[0.65rem] text-muted">
              form r-2 · the mark shrinks the same way it grew
            </p>
          </div>
          <BankForm action="repay" />
        </section>
      </div>

      <p className="mt-10 border-t border-dashed border-rule pt-4 text-center text-xs leading-relaxed text-muted">
        The core asks for your password to act on your account, so it is given
        fresh each time and never kept here. Every deed and slip lands in the{" "}
        <Link href="/ledger" className="underline underline-offset-4">
          ledger
        </Link>{" "}
        like any other entry.
      </p>
    </div>
  );
}