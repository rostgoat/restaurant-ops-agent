"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { TraceLedger, TraceMeta } from "@/components/trace";
import type { Trace } from "@/lib/api";
import { MerchantBadge } from "@/components/merchant-badge";

export function FailureCard({
  id,
  suite,
  tags,
  merchantId,
  question,
  expected,
  reasons,
  diagnosis,
  trace,
}: {
  id: string;
  suite: string;
  tags: string[];
  merchantId: number;
  question: string;
  expected: string;
  reasons: string[];
  diagnosis?: string;
  trace: Trace;
}) {
  const [open, setOpen] = useState(false);
  return (
    <article className="border-t pt-8">
      <p className="mb-3 font-heading text-base text-primary">
        Evaluation case {id}, from the {suite.split(":")[0].toLowerCase()} suite
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
          <h3 className="mb-2 text-base">What should happen</h3>
          <p className="leading-relaxed">{expected}</p>
        </div>
        <div>
          <h3 className="mb-2 text-base">Why it failed</h3>
          <ul className="list-disc space-y-1 pl-5 leading-relaxed">
            {reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      </div>
      {diagnosis && (
        <div className="mt-6">
          <h3 className="mb-2 text-base">What the trace shows</h3>
          <p className="max-w-[68ch] leading-relaxed">{diagnosis}</p>
        </div>
      )}
      {trace.answer && (
        <div className="mt-6">
          <h3 className="mb-2 text-base">What it answered</h3>
          <p className="leading-relaxed text-muted-foreground">{trace.answer}</p>
        </div>
      )}
      <div className="mt-6">
        <TraceMeta trace={trace} />
      </div>
      <Collapsible open={open} onOpenChange={setOpen} className="mt-6">
        <CollapsibleTrigger asChild>
          <Button size="lg" variant={open ? "outline" : "default"} className="h-11 px-5 font-heading text-base">
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
