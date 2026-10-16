import { PageHead } from "@/components/page-head";
import { SignIn } from "@/components/sign-in";

export const metadata = { title: "Sign In" };

export default function Page() {
  return (
    <>
      <PageHead
        kicker="Territorial Bounty Office"
        title="Sign In"
        lede="Sign in with your bank username and password."
      />
      <SignIn />
    </>
  );
}