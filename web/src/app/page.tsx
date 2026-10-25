import Link from "next/link";
import { Kicker } from "@/components/kicker";
import { ScenarioCard } from "@/components/scenario-card";
import { Button } from "@/components/ui/button";
import { questionStats } from "@/lib/api";
import type { Scenario } from "@/lib/scenarios";
import fileDispute from "@/content/scenarios/file-dispute.json";

const scenario = fileDispute as Scenario;

export const instant = false;

export default async function HomePage() {
  const stats = await questionStats(scenario.merchant_id, scenario.question);
  return (
    <>
      <section>
        <Kicker />
        <h1 className="mt-4 max-w-[30ch] text-5xl sm:text-6xl">
          An AI agent that answers a restaurant&apos;s questions and never acts
          on its own.
        </h1>
        <p className="mt-8 text-xl leading-relaxed text-muted-foreground">
          The <span className="font-semibold text-model">model</span> turns a
          plain question into SQL and reads the restaurant&apos;s own written
          policies. <span className="font-semibold text-code">Code</span>{" "}
          decides what may run, keeps each restaurant to its own data and its
          own rules, and records every step with what it cost. A{" "}
          <span className="font-semibold text-human">person</span> approves
          anything that would change something.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button
            asChild
            size="lg"
            className="h-11 px-5 font-heading text-base"
          >
            <Link href="/scenarios">See the scenarios</Link>
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
