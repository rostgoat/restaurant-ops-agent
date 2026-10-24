"use client";

import { useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { StatusBadge, TraceLedger, statusLine } from "@/components/trace";
import { dollars, seconds } from "@/lib/format";
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

export function ScenarioCard({ scenario }: { scenario: Scenario }) {
  const [open, setOpen] = useState(false);
  const t = scenario.trace;
  return (
    <article className="border-t pt-8">
      <h2 className="text-2xl">{scenario.title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Asked as {merchantName[scenario.merchant_id]}
      </p>
      <p className="mt-6 font-heading text-lg">{scenario.question}</p>

      <div className="mt-6 grid gap-8 md:grid-cols-2">
        <div>
          <h3 className="mb-2 text-base">What should happen</h3>
          <p className="text-muted-foreground">{scenario.expected}</p>
        </div>
        <div>
          <h3 className="mb-2 text-base">What happened</h3>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <StatusBadge status={t.status} />
            {toolsUsed(scenario).map((u) => (
              <Badge key={u} variant="outline">
                {u}
              </Badge>
            ))}
          </div>
          {t.answer && (
            <div className="space-y-3 leading-relaxed [&_li]:ml-5 [&_ol]:list-decimal [&_table]:w-full [&_td]:border-t [&_td]:py-1 [&_td]:pr-3 [&_th]:py-1 [&_th]:pr-3 [&_th]:text-left [&_th]:font-normal [&_th]:text-muted-foreground [&_ul]:list-disc">
              <Markdown remarkPlugins={[remarkGfm]}>{t.answer}</Markdown>
            </div>
          )}
          <p className="mt-3 text-sm text-muted-foreground">
            {statusLine(t)} {dollars(t.cost_usd)}, {seconds(t.latency_ms)}, {t.steps.length}{" "}
            {t.steps.length === 1 ? "step" : "steps"}.
          </p>
        </div>
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
