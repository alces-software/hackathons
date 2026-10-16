import { PageHead } from "@/components/page-head";
import { Settled } from "@/components/settled";

export const metadata = { title: "Settled" };

export default function Page() {
  return (
    <>
      <PageHead
        kicker="Completed bounties"
        title="Settled"
        lede="Bounties that have been paid out, pulled from the board and stamped."
      />
      <Settled />
    </>
  );
}