import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { AuthForm } from "@/components/auth-form";

export const metadata = { title: "Sign in" };

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LoginPage({ searchParams }: Props) {
  const me = await getSession();
  if (me) {
    redirect("/me");
  }

  const sp = await searchParams;
  const nextRaw = Array.isArray(sp.next) ? sp.next[0] : sp.next;
  const next = nextRaw?.startsWith("/") ? nextRaw : undefined;

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="font-serif text-3xl">Sign in</h1>
      <p className="mt-2 text-sm text-muted">
        Take your place back on the book.
      </p>

      <AuthForm mode="login" next={next} />

      <p className="mt-6 border-t border-rule pt-4 text-xs leading-relaxed text-muted">
        The core keeps no sessions of its own and does not yet check passwords
        at sign-in — you are vouching for yourself. Passwords matter for
        opening and closing accounts.
      </p>
      <p className="mt-3 text-xs text-muted">
        No account yet?{" "}
        <Link href="/signup" className="underline underline-offset-4">
          Open one
        </Link>
        .
      </p>
    </div>
  );
}