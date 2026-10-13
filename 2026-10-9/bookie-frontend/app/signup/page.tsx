import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { AuthForm } from "@/components/auth-form";

export const metadata = { title: "Open an account" };

export default async function SignupPage() {
  const me = await getSession();
  if (me) {
    redirect("/me");
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="sheet p-6 sm:p-8">
        <div className="border-b border-dashed border-rule pb-3 text-center">
          <p className="sc">Application for an account</p>
          <p className="mt-1 font-mono text-[0.65rem] text-muted">
            form a-1 · no references required
          </p>
        </div>

        <AuthForm mode="signup" />

        <p className="mt-6 border-t border-dashed border-rule pt-4 text-center text-xs leading-relaxed text-muted">
          Your name goes at the top of a column in the book; every service that
          takes a payment from you writes its line beneath it. Already on the
          book?{" "}
          <Link href="/login" className="underline underline-offset-4">
            Present yourself
          </Link>
          .
        </p>
      </div>
    </div>
  );
}