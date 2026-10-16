import { PageHead } from "@/components/page-head";
import { Postings } from "@/components/postings";

export const metadata = { title: "The Board" };

export default function Page() {
  return (
    <>
      <PageHead
        kicker="Open bounties"
        title="The Board"
        lede="Every reward below is held in escrow by the bank before the bounty goes up. Settle a bounty once the work is done."
      />
      <Postings />
    </>
  );
}