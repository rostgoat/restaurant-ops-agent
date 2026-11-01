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
  const [run, setRun] = useState(views.filter((v) => v.ran).at(-1)?.run);
  const [open, setOpen] = useState(traceOpen);
  const view = views.find((v) => v.run === run);

  if (!view || !view.trace) return null;
  const trace = view.trace;
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
            disabled={!v.ran}
            title={v.ran ? undefined : "This case was not in this run"}
            onClick={() => setRun(v.run)}
          >
            {v.label}{" "}
            {v.ran ? <OutcomeBadge outcome={v.outcome} /> : <span className="text-xs font-normal">not run</span>}
          </Button>
        ))}
      </div>

      <div className="mt-6 grid gap-8 md:grid-cols-2">
        <div>
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
        {view.diagnosis && (
          <div>
            <Heading className={headingClass}>What the {view.label.toLowerCase()} trace shows</Heading>
            <ul className="list-disc space-y-1 pl-5 leading-relaxed">
              {view.diagnosis.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {goldSql && (
        <div className="mt-6">
          <TwoQueries gold={goldSql} model={view.modelSql} />
        </div>
      )}

      {trace.answer && (
        <div className="mt-6">
          <Heading className={headingClass}>What it answered</Heading>
          <Answer
            text={trace.answer}
            merchantId={merchantId}
            className={large ? "text-lg leading-relaxed" : "text-muted-foreground"}
          />
        </div>
      )}

      <div className="mt-6">
        <TraceMeta trace={trace} />
      </div>

      <Collapsible open={open} onOpenChange={setOpen} className="mt-6">
        <CollapsibleTrigger asChild>
          <Button size="lg" variant={open ? "outline" : "default"} className="h-11 px-5 font-heading text-base">
            <ListTree className="size-4" aria-hidden />
            {open ? `Hide the ${view.label.toLowerCase()} trace` : `Show the ${view.label.toLowerCase()} trace`}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-8">
          <TraceLedger trace={trace} />
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
