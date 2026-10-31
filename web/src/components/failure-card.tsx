"use client";

import { useState } from "react";
import Link from "next/link";
import { ListTree } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { TraceLedger, TraceMeta } from "@/components/trace";
import { TwoQueries } from "@/components/two-queries";
import { Answer } from "@/components/answer";
import type { Trace } from "@/lib/api";
import { MerchantBadge } from "@/components/merchant-badge";

export function FailureCard({
  id,
  headline,
  suite,
  tags,
  merchantId,
  question,
  expected,
  reasons,
  diagnosis,
  goldSql,
  modelSql,
  trace,
}: {
  id: string;
  headline?: string;
  suite: string;
  tags: string[];
  merchantId: number;
  question: string;
  expected: string;
  reasons: string[];
  diagnosis?: string;
  goldSql?: string;
  modelSql?: string | null;
  trace: Trace;
}) {
  const [open, setOpen] = useState(false);

  return (
    <article className="border-t pt-8">
      <h3 className="text-2xl">{headline ?? `Case ${id}`}</h3>
      <p className="mt-2 mb-3 text-sm text-muted-foreground">
        <Link href={`/evaluation/${id}`} className="font-sql text-xs text-primary underline-offset-4 hover:underline">
          {id}
        </Link>
        , from the {suite.split(":")[0].toLowerCase()} suite
      </p>
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
        <div>
          <h4 className="mb-2 text-base">Why it failed</h4>
          <ul className="list-disc space-y-1 pl-5 leading-relaxed">
            {reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      </div>
      {diagnosis && (
        <div className="mt-6">
          <h4 className="mb-2 text-base">What the trace shows</h4>
          <p className=" leading-relaxed">{diagnosis}</p>
        </div>
      )}
      {goldSql && (
        <div className="mt-6">
          <TwoQueries gold={goldSql} model={modelSql ?? null} />
        </div>
      )}
      {trace.answer && (
        <div className="mt-6">
          <h4 className="mb-2 text-base">What it answered</h4>
          <Answer text={trace.answer} merchantId={merchantId} className="text-muted-foreground" />
        </div>
      )}
      <div className="mt-6">
        <TraceMeta trace={trace} />
      </div>
      <Collapsible open={open} onOpenChange={setOpen} className="mt-6">
        <CollapsibleTrigger asChild>
          <Button size="lg" variant={open ? "outline" : "default"} className="h-11 px-5 font-heading text-base">
            <ListTree className="size-4" aria-hidden />
            {open ? "Hide the trace" : "Show the trace"}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-8">
          <TraceLedger trace={trace} />
        </CollapsibleContent>
      </Collapsible>
    </article>
  );
}
