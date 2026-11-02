import Link from "next/link";
import { MerchantBadge } from "@/components/merchant-badge";
import { RunViewer } from "@/components/run-viewer";
import {
  describeExpectation,
  headline,
  runViews,
  suiteTitle,
  type Result,
  type RunView,
} from "@/lib/evaluation";

export function CaseFailure({ result: r }: { result: Result }) {
  return (
    <FailureCard
      id={r.case.id}
      headline={headline[r.case.id]}
      suite={suiteTitle[r.case.suite] ?? r.case.suite}
      merchantId={r.case.merchant_id}
      question={r.case.question}
      expected={describeExpectation(r)}
      goldSql={r.case.gold_sql}
      views={runViews(r.case.id)}
    />
  );
}

export function FailureCard({
  id,
  headline,
  suite,
  merchantId,
  question,
  expected,
  goldSql,
  views,
}: {
  id: string;
  headline?: string;
  suite: string;
  merchantId: number;
  question: string;
  expected: string;
  goldSql?: string;
  views: RunView[];
}) {
  return (
    <article className="border-t pt-8">
      <h3 className="text-2xl">{headline ?? `Case ${id}`}</h3>
      <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted-foreground">
        <span>
          <Link href={`/evaluation/${id}`} className="font-sql text-xs text-primary underline-offset-4 hover:underline">
            {id}
          </Link>
           · {suite.split(":")[0]} tests
        </span>
        <span aria-hidden>·</span>
        <span className="flex items-center gap-2">
          Restaurant: <MerchantBadge merchantId={merchantId} />
        </span>
      </p>
      <blockquote className="mt-4 rounded-md bg-muted px-5 py-4 text-lg italic leading-relaxed">
        {question}
      </blockquote>
      <div className="mt-8">
        <h4 className="mb-2 text-base">Expected result</h4>
        <p className="max-w-[70ch] leading-relaxed">{expected}</p>
      </div>
      <div className="mt-10">
        <RunViewer views={views} merchantId={merchantId} goldSql={goldSql} />
      </div>
    </article>
  );
}
