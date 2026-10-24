import { ScenarioCard } from "@/components/scenario-card";
import { ScenarioToc } from "@/components/scenario-toc";
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
import fileDispute from "@/content/scenarios/file-dispute.json";
import disputeTooLate from "@/content/scenarios/dispute-too-late.json";
import textCampaign from "@/content/scenarios/text-campaign.json";

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
  fileDispute,
  disputeTooLate,
  textCampaign,
] as Scenario[];

export default function ScenariosPage() {
  const when = new Date(scenarios[0].trace.created_at).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const items = scenarios.map((s) => ({ slug: s.slug, title: s.title }));
  return (
    <>
      <section>
        <p className="font-heading text-base text-primary">Applied AI case study</p>
        <h1 className="mt-4 max-w-[30ch] text-5xl sm:text-6xl">
          Thirteen cases, with what should happen written down first.
        </h1>
        <p className="mt-8 max-w-[76ch] text-xl leading-relaxed text-muted-foreground">
          Thirteen questions put to two restaurants that run on six different written policies,
          answered by Claude Sonnet 5.5 on {when}. Each case states the expected behaviour
          before showing what happened, so you can judge the system rather than take its word.
          Several questions are asked at both restaurants so the difference in their rules
          shows, and nothing has been edited, including what did not go to plan.
        </p>
      </section>
      <div className="mt-20 space-y-16">
        {scenarios.map((s, i) => (
          <ScenarioCard key={s.slug} scenario={s} kicker={`Scenario ${i + 1} of ${scenarios.length}`} />
        ))}
      </div>
      <ScenarioToc items={items} />
    </>
  );
}
