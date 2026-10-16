import { PageHead } from "@/components/page-head";
import { FileNotice } from "@/components/file-notice";

export const metadata = { title: "Post a Bounty" };

export default function Page() {
  return (
    <>
      <PageHead
        kicker="Form B-7"
        title="Post a Bounty"
        lede="The reward is taken from your balance and held in escrow as soon as the bounty is posted. You settle it once the work is done."
      />
      <FileNotice />
    </>
  );
}