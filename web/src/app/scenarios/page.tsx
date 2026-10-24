import { ScenarioCard } from "@/components/scenario-card";
import { Kicker } from "@/components/kicker";
import { ScenarioToc } from "@/components/scenario-toc";
import type { Scenario } from "@/lib/scenarios";

import deliveryVsCounter from "@/content/scenarios/delivery-vs-counter.json";
import injection from "@/content/scenarios/injection.json";
import repeatRefunder from "@/content/scenarios/repeat-refunder.json";
import textCampaign from "@/content/scenarios/text-campaign.json";
import fileDispute from "@/content/scenarios/file-dispute.json";

const scenarios = [
  deliveryVsCounter,
  injection,
  repeatRefunder,
  textCampaign,
  fileDispute,
] as Scenario[];

export const metadata = { title: "Scenarios" };

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
        <Kicker page="Scenarios" />
        <h1 className="mt-4 max-w-[30ch] text-5xl sm:text-6xl">
          Five questions, simplest first, with what should happen written down before each was asked.
        </h1>
        <p className="mt-8 text-xl leading-relaxed text-muted-foreground">
          Five questions, in order of how much the system has to do, put to two restaurants that run on six different written policies,
          answered by Claude Sonnet 5.5 on {when}. Each one states the expected behaviour
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
