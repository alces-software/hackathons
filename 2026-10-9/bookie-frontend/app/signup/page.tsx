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
    <div className="mx-auto max-w-sm">
      <h1 className="font-serif text-3xl">Open an account</h1>
      <p className="mt-2 text-sm text-muted">
        Your name goes at the top of a column in the book; every service that
        takes a payment from you writes its line beneath it.
      </p>

      <AuthForm mode="signup" />
      <p className="mt-6 text-xs text-muted">
        Already on the book?{" "}
        <Link href="/login" className="underline underline-offset-4">
          Sign in
        </Link>
        .
      </p>
    </div>
  );
}