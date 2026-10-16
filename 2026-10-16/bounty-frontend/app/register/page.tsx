import { PageHead } from "@/components/page-head";
import { Register } from "@/components/register";

export const metadata = { title: "Register" };

export default function Page() {
  return (
    <>
      <PageHead
        kicker="Territorial Bank & Trust"
        title="Register"
        lede="All bank accounts on record, sorted by balance."
      />
      <Register />
    </>
  );
}