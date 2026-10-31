"use client";

import { useState } from "react";
import { ListTree } from "lucide-react";
import { Answer } from "@/components/answer";
import { OutcomeBadge } from "@/components/outcome-badge";
import { TraceLedger, TraceMeta } from "@/components/trace";
import { TwoQueries } from "@/components/two-queries";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { RunView } from "@/lib/evaluation";

// One case across the runs: a button per run, and the chosen run's grade,
// queries, answer and trace together, so the comparison is one click.
export function RunViewer({
  views,
  merchantId,
  goldSql,
  large = false,
  traceOpen = false,
}: {
  views: RunView[];
  merchantId: number;
  goldSql?: string;
  large?: boolean;
  traceOpen?: boolean;
}) {
  const [run, setRun] = useState(views[views.length - 1]?.run);
  const [open, setOpen] = useState(traceOpen);
  const view = views.find((v) => v.run === run);

  if (!view) return null;
  const Heading = large ? "h2" : "h4";
  const headingClass = large ? "mb-3 text-xl" : "mb-2 text-base";

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {views.map((v) => (
          <Button
            key={v.run}
            size="lg"
            variant={v.run === run ? "default" : "outline"}
            className="h-11 px-5 font-heading text-base"
            onClick={() => setRun(v.run)}
          >
            {v.label} <OutcomeBadge outcome={v.outcome} />
          </Button>
        ))}
      </div>

      <div className="mt-6">
        <Heading className={headingClass}>What the grader found in {view.label.toLowerCase()}</Heading>
        {view.reasons.length > 0 ? (
          <ul className="list-disc space-y-1 pl-5 leading-relaxed">
            {view.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        ) : (
          <p className="leading-relaxed">Passed.</p>
        )}
      </div>

      {goldSql && (
        <div className="mt-6">
          <TwoQueries gold={goldSql} model={view.modelSql} />
        </div>
      )}

      {view.trace.answer && (
        <div className="mt-6">
          <Heading className={headingClass}>What it answered</Heading>
          <Answer
            text={view.trace.answer}
            merchantId={merchantId}
            className={large ? "text-lg leading-relaxed" : "text-muted-foreground"}
          />
        </div>
      )}

      <div className="mt-6">
        <TraceMeta trace={view.trace} />
      </div>

      <Collapsible open={open} onOpenChange={setOpen} className="mt-6">
        <CollapsibleTrigger asChild>
          <Button size="lg" variant={open ? "outline" : "default"} className="h-11 px-5 font-heading text-base">
            <ListTree className="size-4" aria-hidden />
            {open ? `Hide the ${view.label.toLowerCase()} trace` : `Show the ${view.label.toLowerCase()} trace`}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-8">
          <TraceLedger trace={view.trace} />
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
