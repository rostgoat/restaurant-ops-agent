import type { Metadata } from "next";
import Link from "next/link";
import { Kicker } from "@/components/kicker";
import { CaseCard } from "@/components/case-card";
import { Button } from "@/components/ui/button";
import { data, headline, runs } from "@/lib/evaluation";
import { SITE_DESCRIPTION } from "@/lib/site";

const wrongNumber = data.results.find((r) => r.case.id === "sql-05")!;
const caught = data.results.find((r) => r.case.id === "pro-06")!;

function cents(usd: number | null): string {
  const c = Math.round((usd ?? 0) * 100);

  return c === 1 ? "1 cent" : `${c} cents`;
}

function seconds(ms: number | null): string {
  const sec = Math.round((ms ?? 0) / 1000);

  return `${sec} seconds`;
}

export const metadata: Metadata = {
  description: SITE_DESCRIPTION,
  alternates: { canonical: "/" },
};

export default function HomePage() {
  return (
    <>
      <section>
        <Kicker />
        <h1 className="mt-4 max-w-[36ch] text-4xl sm:text-6xl">
          I built an agent that answers a restaurant owner&apos;s questions. Then I tried to find out
          what happens when it is wrong.
        </h1>
        <p className="mt-8 text-xl leading-relaxed text-muted-foreground">There are three ways it can be wrong.</p>
        <ol className="mt-4 list-decimal space-y-2 pl-6 text-xl leading-relaxed text-muted-foreground">
          <li>An action that breaks a rule. Caught by code before anyone sees it.</li>
          <li>
            A query that is safe but answers the wrong question. Not caught by anything, so I
            measure how often it happens.
          </li>
          <li>
            A cited section that does not support the answer. Not caught by anything, and not
            seen yet in 34 questions written to cause it.
          </li>
        </ol>
        <p className="mt-4 text-xl leading-relaxed text-muted-foreground">
          The{" "}
          <Link href="/evaluation" className="text-primary underline-offset-4 hover:underline">
            evaluation
          </Link>{" "}
          is that record, one run at a time.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button
            asChild
            size="lg"
            className="h-11 px-5 font-heading text-base"
          >
            <Link href="/evaluation">See the evaluation</Link>
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

      <section className="mt-16 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          [String(data.summary.cases), "questions"],
          [String(runs.length), "runs"],
          [cents(data.summary.cost_per_answered_median_usd), "per answer"],
          [seconds(data.summary.latency_median_ms), "per answer"],
        ].map(([figure, label]) => (
          <div key={`${figure} ${label}`} className="rounded-lg border bg-card px-5 py-4">
            <p className="font-heading text-3xl">{figure}</p>
            <p className="mt-1 text-sm text-muted-foreground">{label}</p>
          </div>
        ))}
      </section>

      <section className="mt-28 space-y-12">
        <CaseCard
          id={wrongNumber.case.id}
          kicker="Measured, not caught"
          headline={headline[wrongNumber.case.id]}
          merchantId={wrongNumber.case.merchant_id}
          question={wrongNumber.case.question}
          lines={[
            "The query passed every safety check and ran clean. Its date range started and ended ten hours early.",
            "It answered $2.49. The right figure is $2.64, and only my own query, run afterwards, could tell.",
            "A line in the prompt fixed it in run 3. A wrong window written another way would still run.",
          ]}
        />
        <CaseCard
          id={caught.case.id}
          kicker="Caught by code"
          headline="The agent said 121 customers. Code counted 563."
          merchantId={caught.case.merchant_id}
          question={caught.case.question}
          lines={[
            "Of 29,762 customers with a phone number, 563 have verified consent and have not unsubscribed.",
            "In two runs the agent put the audience at 121. The checker recounts it from the consent flags and uses its own number.",
            "563 is over the 500 cap, so the campaign waited for the owner in every run. Nothing was sent.",
          ]}
        />
      </section>

      <section className="mt-16">
        <Button asChild size="lg" className="h-14 px-8 font-heading text-lg">
          <Link href="/evaluation">See the evaluation</Link>
        </Button>
      </section>
    </>
  );
}
