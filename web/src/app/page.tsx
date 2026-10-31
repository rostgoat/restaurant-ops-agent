import type { Metadata } from "next";
import Link from "next/link";
import { Kicker } from "@/components/kicker";
import { ScenarioCard } from "@/components/scenario-card";
import { Button } from "@/components/ui/button";
import { questionStats } from "@/lib/api";
import { SITE_DESCRIPTION } from "@/lib/site";
import type { Scenario } from "@/lib/scenarios";
import fileDispute from "@/content/scenarios/file-dispute.json";

const scenario = fileDispute as Scenario;

export const instant = false;

export const metadata: Metadata = {
  description: SITE_DESCRIPTION,
  alternates: { canonical: "/" },
};

export default async function HomePage() {
  const stats = await questionStats(scenario.merchant_id, scenario.question);

  return (
    <>
      <section>
        <Kicker />
        <h1 className="mt-4 max-w-[36ch] text-4xl sm:text-6xl">
          I built an agent that answers a restaurant owner&apos;s questions. Then I tried to find out
          what happens when it is wrong.
        </h1>
        <p className="mt-8 text-xl leading-relaxed text-muted-foreground">Three kinds of wrong turned up.</p>
        <ol className="mt-4 list-decimal space-y-2 pl-6 text-xl leading-relaxed text-muted-foreground">
          <li>An action that breaks a rule. Caught by code before anyone sees it.</li>
          <li>
            A query that is safe but answers the wrong question. Not caught by anything, so I
            measure how often it happens.
          </li>
          <li>A cited section that does not support the answer. Neither caught nor measured yet.</li>
        </ol>
        <p className="mt-4 text-xl leading-relaxed text-muted-foreground">
          The{" "}
          <Link href="/evaluation" className="text-primary underline-offset-4 hover:underline">
            evaluation
          </Link>{" "}
          is the record of finding that out, one run at a time, with the numbers.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button
            asChild
            size="lg"
            className="h-11 px-5 font-heading text-base"
          >
            <Link href="/evaluation">See the runs</Link>
          </Button>
          <Button
            asChild
            variant="outline"
            size="lg"
            className="h-11 px-5 font-heading text-base"
          >
            <a href="https://github.com/rostgoat/restaurant-ops-agent">
              View the code
            </a>
          </Button>
        </div>
      </section>

      <section className="mt-28">
        <ScenarioCard
          scenario={scenario}
          kicker="Scenario 5 of 5: a dispute the model proposes, code checks, and the owner approves."
          stats={stats}
        />
      </section>
    </>
  );
}
