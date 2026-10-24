import Link from "next/link";
import { ScenarioCard } from "@/components/scenario-card";
import { Button } from "@/components/ui/button";
import type { Scenario } from "@/lib/scenarios";
import missingItemDispute from "@/content/scenarios/missing-item-dispute.json";

const scenario = missingItemDispute as Scenario;

export default function HomePage() {
  return (
    <>
      <section>
        <p className="font-heading text-base text-primary">
          Applied AI case study
        </p>
        <h1 className="mt-4 max-w-[30ch] text-5xl sm:text-6xl">
          Building an AI agent a restaurant can trust with its data and its
          rules.
        </h1>
        <p className="mt-8 max-w-[76ch] text-xl leading-relaxed text-muted-foreground">
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
        <ScenarioCard scenario={scenario} kicker="Example scenario, one of thirteen" />
      </section>
    </>
  );
}
