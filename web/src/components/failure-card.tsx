import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { RunHistory } from "@/components/every-case";
import { MerchantBadge } from "@/components/merchant-badge";
import { RunViewer } from "@/components/run-viewer";
import type { RunRecord, RunView } from "@/lib/evaluation";

export function FailureCard({
  id,
  headline,
  suite,
  tags,
  merchantId,
  question,
  expected,
  diagnosis,
  goldSql,
  runs,
  views,
}: {
  id: string;
  headline?: string;
  suite: string;
  tags: string[];
  merchantId: number;
  question: string;
  expected: string;
  diagnosis?: string;
  goldSql?: string;
  runs: RunRecord[];
  views: RunView[];
}) {
  return (
    <article className="border-t pt-8">
      <h3 className="text-2xl">{headline ?? `Case ${id}`}</h3>
      <p className="mt-2 text-sm text-muted-foreground">
        <Link href={`/evaluation/${id}`} className="font-sql text-xs text-primary underline-offset-4 hover:underline">
          {id}
        </Link>
        , from the {suite.split(":")[0].toLowerCase()} suite
      </p>
      <div className="mt-2 mb-3">
        <RunHistory id={id} runs={runs} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {tags.map((t) => (
          <Badge key={t} variant="secondary">
            {t}
          </Badge>
        ))}
      </div>
      <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
        Asked as <MerchantBadge merchantId={merchantId} />
      </p>
      <blockquote className="mt-4 rounded-md bg-muted px-5 py-4 text-lg italic leading-relaxed">
        {question}
      </blockquote>
      <div className="mt-6 grid gap-8 md:grid-cols-2">
        <div>
          <h4 className="mb-2 text-base">What should happen</h4>
          <p className="leading-relaxed">{expected}</p>
        </div>
        {diagnosis && (
          <div>
            <h4 className="mb-2 text-base">What the trace shows</h4>
            <p className="leading-relaxed">{diagnosis}</p>
          </div>
        )}
      </div>
      <div className="mt-6">
        <RunViewer views={views} merchantId={merchantId} goldSql={goldSql} />
      </div>
    </article>
  );
}
