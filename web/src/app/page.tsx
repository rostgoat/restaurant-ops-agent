import type { Metadata } from "next";
import Link from "next/link";
import { Kicker } from "@/components/kicker";
import { CaseCard } from "@/components/case-card";
import { Button } from "@/components/ui/button";
import { data, headline, runs } from "@/lib/evaluation";
import { SITE_DESCRIPTION } from "@/lib/site";

const wrongNumber = data.results.find((r) => r.case.id === "sql-05")!;
const caught = data.results.find((r) => r.case.id === "pro-06")!;
const hidden = data.results.find((r) => r.case.id === "pol-02")!;

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
        <p className="mt-8 text-xl leading-relaxed text-muted-foreground">
          I tested three ways it could go wrong.
        </p>
        <ol className="mt-4 list-decimal space-y-2 pl-6 text-xl leading-relaxed text-muted-foreground">
          <li>An action that breaks a rule. Caught by code before anyone sees it.</li>
          <li>
            A query that is safe but answers the wrong question. Not caught by anything, so I
            measure how often it happens.
          </li>
          <li>
            A cited section that does not support the answer. Not caught by anything, and not
            seen yet, in the runs or in questions written to cause it.
          </li>
        </ol>
        <p className="mt-4 text-xl leading-relaxed text-muted-foreground">
          The{' '}
          <Link href="/evaluation" className="text-primary underline-offset-4 hover:underline">
            evaluation results
          </Link>{' '}
          show the failures, the changes I made, and the cost of each run.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button
            asChild
            size="lg"
            className="h-11 px-5 font-heading text-base"
          >
            <Link href="/evaluation">View evaluation results</Link>
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
          [String(data.summary.cases), "test questions"],
          [String(runs.length), "evaluation runs"],
          [cents(data.summary.cost_per_answered_median_usd), "median cost per answer"],
          [seconds(data.summary.latency_median_ms), "median response time"],
        ].map(([figure, label]) => (
          <div key={`${figure} ${label}`} className="rounded-lg border bg-card px-5 py-4">
            <p className="font-heading text-3xl">{figure}</p>
            <p className="mt-1 text-sm text-muted-foreground">{label}</p>
          </div>
        ))}
      </section>

      <p className="mt-3 text-sm text-muted-foreground">
        Cost and response time are from the latest evaluation run.
      </p>

      <section className="mt-28 space-y-12">
        <CaseCard
          id={caught.case.id}
          kicker="Caught by code"
          headline="The action checker corrected the customer count"
          merchantId={caught.case.merchant_id}
          question={caught.case.question}
          lines={[
            "Of 29,762 customers with phone numbers, 563 have verified consent and have not unsubscribed.",
            "In two runs, the agent estimated 121 eligible customers. The action checker counted them from the database and replaced that estimate with 563.",
            "That exceeds the 500-customer limit, so the campaign required the owner's approval in every run. No messages were sent.",
          ]}
        />
        <CaseCard
          id={wrongNumber.case.id}
          kicker="Measured, not caught"
          headline={headline[wrongNumber.case.id]}
          merchantId={wrongNumber.case.merchant_id}
          question={wrongNumber.case.question}
          lines={[
            "The query passed the safety checks, but a time zone error shifted both ends of its date range ten hours early.",
            "The agent answered $2.49. My reference query gave $2.64, so the test failed.",
            "Date conversion instructions corrected this case in run 3. The safety checks still cannot tell whether a query uses the dates the owner intended.",
          ]}
        />
        <CaseCard
          id={hidden.case.id}
          kicker="A fourth thing, found on the way: hidden by the search, fixed by changing it"
          headline={headline[hidden.case.id]}
          merchantId={hidden.case.merchant_id}
          question={hidden.case.question}
          lines={[
            "Ridgeline's policies say it does not use delivery marketplaces. Search missed that section in four of the first five runs, and the agent gave advice without it.",
            "An early search gave the section a similarity score of 0.28, below the threshold, even though it contained the word DoorDash.",
            "Run 6 added keyword matching. The section ranked first for DoorDash, was shown to the agent, and has been cited in every run since.",
          ]}
        />
      </section>

      <section className="mt-16">
        <Button asChild size="lg" className="h-14 px-8 font-heading text-lg">
          <Link href="/evaluation">View evaluation results</Link>
        </Button>
      </section>
    </>
  );
}
