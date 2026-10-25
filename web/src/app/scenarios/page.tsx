import { ScenarioCard } from "@/components/scenario-card";
import { Kicker } from "@/components/kicker";
import { pageMetadata } from "@/lib/site";
import { PageOutline } from "@/components/page-outline";
import { questionStats } from "@/lib/api";
import { scenarios } from "@/lib/scenarios";

export const metadata = pageMetadata(
  "Scenarios",
  "Five questions put to two fictional restaurants, simplest first, with what should happen written before each was asked, the captured answer, and the full trace. Each can be rerun live.",
  "/scenarios",
);

// Rendered on every request, with no loading state, so the "asked N times"
// line is current when the page opens.
export const instant = false;

export default async function ScenariosPage() {
  const stats = await Promise.all(scenarios.map((s) => questionStats(s.merchant_id, s.question)));
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
        <h1 className="mt-4 max-w-[30ch] text-4xl sm:text-6xl">
          Five scenarios, from a plain query to an approved action.
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
          <ScenarioCard key={s.slug} scenario={s} kicker={`Scenario ${i + 1} of ${scenarios.length}`} stats={stats[i]} />
        ))}
      </div>
      <PageOutline items={items} />
    </>
  );
}
