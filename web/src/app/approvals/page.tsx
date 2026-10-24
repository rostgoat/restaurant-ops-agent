import Link from "next/link";
import { MerchantPicker } from "@/components/merchant-picker";
import { ProposalCard } from "@/components/proposal-card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ApiUnreachable, getMerchants, getProposals } from "@/lib/api";
import { currentMerchant } from "@/lib/merchant";

export const instant = false;

export default async function ApprovalsPage() {
  return (
    <>
      <section>
        <p className="font-heading text-base text-primary">Applied AI case study</p>
        <h1 className="mt-4 max-w-[30ch] text-5xl sm:text-6xl">
          Nothing happens until a person says so.
        </h1>
        <p className="mt-8 max-w-[76ch] text-xl leading-relaxed text-muted-foreground">
          When the agent proposes an action, code checks it against the restaurant&apos;s
          written policy and its data first: the dispute window for that marketplace, the
          discount cap, who has consented to texts, the comp limit. What survives waits here
          for the owner. Approving records the action and its artifact; nothing here reaches a
          marketplace, a phone, or a register. The decision becomes a Human step in the trace.
        </p>
      </section>
      <div className="mt-20">
        <List />
      </div>
    </>
  );
}

async function List() {
  const merchantId = await currentMerchant();
  let proposals;
  let merchants;
  let merchant;
  try {
    merchants = await getMerchants();
    merchant = merchants.find((m) => m.id === merchantId) ?? merchants[0];
    proposals = await getProposals(merchant.id);
  } catch (e) {
    console.error("approvals: failed to load", e);
    const message = e instanceof ApiUnreachable ? e.message : "The API returned an error.";
    return (
      <Alert variant="destructive" className="max-w-[68ch]">
        <AlertTitle>{message}</AlertTitle>
        <AlertDescription>Start the API and reload.</AlertDescription>
      </Alert>
    );
  }
  const picker = (
    <div className="mb-8">
      <MerchantPicker merchants={merchants} current={merchant.id} />
    </div>
  );
  if (proposals.length === 0) {
    return (
      <>
        {picker}
      <p className="max-w-[68ch] text-lg text-muted-foreground">
        No proposals yet for this restaurant. On the{" "}
        <Link href="/ask" className="text-primary underline-offset-4 hover:underline">
          Ask page
        </Link>
        , try &ldquo;File the dispute for order 100660&rdquo; as Mekong Noodle House, or ask
        Ridgeline Coffee to text its regulars an offer.
      </p>
      </>
    );
  }
  return (
    <>
      {picker}
      <div className="space-y-6">
        {proposals.map((p) => (
          <ProposalCard key={p.id} proposal={p} />
        ))}
      </div>
    </>
  );
}
