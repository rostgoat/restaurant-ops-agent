"use client";

import { useState } from "react";
import { Answer } from "@/components/answer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { TraceLedger, TraceMeta } from "@/components/trace";
import { merchantName, type Scenario } from "@/lib/scenarios";

function toolsUsed(s: Scenario): string[] {
  const names = new Set(s.trace.steps.map((st) => st.name));
  const used: string[] = [];
  if (names.has("run_sql")) used.push("SQL");
  if (names.has("search_policy")) used.push("policy");
  const citations = s.trace.steps.find((st) => st.name === "citations");
  if (citations) used.push(citations.outcome === "passed" ? "citations checked" : "citations failed");
  const guard = s.trace.steps.find((st) => st.name === "guard");
  if (guard?.outcome === "blocked") used.push("blocked by the guard");
  return used;
}

export function ScenarioCard({ scenario, kicker }: { scenario: Scenario; kicker?: string }) {
  const [open, setOpen] = useState(false);
  const t = scenario.trace;
  return (
    <article id={scenario.slug} className="scroll-mt-10 border-t pt-8">
      {kicker && <p className="mb-3 font-heading text-base text-primary">{kicker}</p>}
      <h2 className="text-2xl">{scenario.title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Asked as {merchantName[scenario.merchant_id]}
      </p>
      <blockquote className="mt-6 rounded-md bg-muted px-5 py-4 text-lg italic leading-relaxed">
        {scenario.question}
      </blockquote>

      <div className="mt-6 grid gap-8 md:grid-cols-2">
        <div>
          <h3 className="mb-2 text-base">What should happen</h3>
          <ul className="list-disc space-y-2 pl-5 leading-relaxed">
            {scenario.expected.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="mb-2 text-base">What happened</h3>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">Used</span>
            {toolsUsed(scenario).map((u) => (
              <Badge key={u} variant="outline">
                {u}
              </Badge>
            ))}
          </div>
          {t.answer && <Answer text={t.answer} merchantId={scenario.merchant_id} />}
        </div>
      </div>

      <div className="mt-8">
        <TraceMeta trace={t} />
      </div>

      <Collapsible open={open} onOpenChange={setOpen} className="mt-6">
        <CollapsibleTrigger asChild>
          <Button size="lg" variant={open ? "outline" : "default"} className="h-11 px-5 font-heading text-base">
            {open ? "Hide the trace" : "Show the trace"}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-8">
          <TraceLedger trace={t} />
        </CollapsibleContent>
      </Collapsible>
    </article>
  );
}
