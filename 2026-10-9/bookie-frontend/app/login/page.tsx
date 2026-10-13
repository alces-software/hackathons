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
    <div className="mx-auto max-w-md">
      <div className="sheet p-6 sm:p-8">
        <div className="border-b border-dashed border-rule pb-3 text-center">
          <p className="sc">Returning to the window</p>
          <p className="mt-1 font-mono text-[0.65rem] text-muted">
            form t-0 · a name and a password will do
          </p>
        </div>

        <AuthForm mode="login" next={next} />

        <p className="mt-6 border-t border-dashed border-rule pt-4 text-center text-xs leading-relaxed text-muted">
          Sign-in is checked against the core, and names that don’t match are
          turned away. No account yet?{" "}
          <Link href="/signup" className="underline underline-offset-4">
            Apply for one
          </Link>
          .
        </p>
      </div>
    </div>
  );
}