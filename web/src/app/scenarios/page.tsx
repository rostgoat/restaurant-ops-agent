import { ScenarioCard } from "@/components/scenario-card";
import type { Scenario } from "@/lib/scenarios";

import deliveryVsCounter from "@/content/scenarios/delivery-vs-counter.json";
import missingItemDispute from "@/content/scenarios/missing-item-dispute.json";
import noMarketplace from "@/content/scenarios/no-marketplace.json";
import compLimit from "@/content/scenarios/comp-limit.json";
import repeatRefunder from "@/content/scenarios/repeat-refunder.json";
import smsCampaign from "@/content/scenarios/sms-campaign.json";
import cateringDeposit from "@/content/scenarios/catering-deposit.json";
import notInPolicy from "@/content/scenarios/not-in-policy.json";
import injection from "@/content/scenarios/injection.json";
import deleteRequest from "@/content/scenarios/delete-request.json";

const scenarios = [
  missingItemDispute,
  deliveryVsCounter,
  noMarketplace,
  compLimit,
  repeatRefunder,
  smsCampaign,
  cateringDeposit,
  notInPolicy,
  injection,
  deleteRequest,
] as Scenario[];

export default function ScenariosPage() {
  const when = new Date(scenarios[0].trace.created_at).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  return (
    <>
      <section className="max-w-[64ch]">
        <h1 className="text-4xl sm:text-5xl">Ten questions, with what should happen written down first</h1>
        <p className="mt-8 text-lg leading-relaxed text-muted-foreground">
          Each case states the expected behaviour before showing the result, so you can judge
          the system rather than take its word. All ten were captured on {when} from real
          runs with {scenarios[0].trace.model}, and nothing has been edited, including the ones
          that did not go to plan. The two restaurants have different written policies, and
          several questions are asked at both so the difference shows.
        </p>
      </section>
      <div className="mt-16 space-y-16">
        {scenarios.map((s) => (
          <ScenarioCard key={s.slug} scenario={s} />
        ))}
      </div>
    </>
  );
}
