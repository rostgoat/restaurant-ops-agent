"use client";

import { useState } from "react";
import { ListTree } from "lucide-react";
import { Answer } from "@/components/answer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { TraceLedger, TraceMeta } from "@/components/trace";
import { MerchantBadge } from "@/components/merchant-badge";
import { QuestionStatsLine, RerunButton, RerunResult, useRerun } from "@/components/rerun-scenario";
import type { QuestionStats } from "@/lib/api";
import type { Scenario } from "@/lib/scenarios";

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

export function ScenarioCard({
  scenario,
  kicker,
  stats,
}: {
  scenario: Scenario;
  kicker?: string;
  stats?: QuestionStats | null;
}) {
  const [open, setOpen] = useState(false);
  const rerun = useRerun(scenario.slug, stats ?? null);
  const capturedOn = new Date(scenario.trace.created_at).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const t = scenario.trace;

  return (
    <article id={scenario.slug} className="scroll-mt-10 border-t pt-8">
      {kicker && <p className="mb-3 font-heading text-base text-primary">{kicker}</p>}
      <h2 className="text-2xl">{scenario.title}</h2>
      <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
        Asked as <MerchantBadge merchantId={scenario.merchant_id} />
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
        <TraceMeta trace={t}>
          <QuestionStatsLine stats={rerun.stats} />
        </TraceMeta>
      </div>

      <Collapsible open={open} onOpenChange={setOpen} className="mt-6">
        <div className="flex flex-wrap items-center gap-3">
          <CollapsibleTrigger asChild>
            <Button size="lg" variant={open ? "outline" : "default"} className="h-11 px-5 font-heading text-base">
              <ListTree className="size-4" aria-hidden />
              {open ? "Hide the trace" : "Show the trace"}
            </Button>
          </CollapsibleTrigger>
          <RerunButton pending={rerun.pending} elapsed={rerun.elapsed} onClick={rerun.run} />
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          Captured on {capturedOn}. Rerunning puts the same question to the agent live, for a few
          cents and about ten seconds. Each run is kept so you can flip between them.
        </p>
        <CollapsibleContent className="mt-8">
          <TraceLedger trace={t} />
        </CollapsibleContent>
      </Collapsible>
      <RerunResult
        runs={rerun.runs}
        shown={rerun.shown}
        setShown={rerun.setShown}
        error={rerun.error}
        merchantId={scenario.merchant_id}
      />
    </article>
  );
}
