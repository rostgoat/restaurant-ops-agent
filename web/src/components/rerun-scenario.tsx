"use client";

import { useEffect, useState, useTransition } from "react";
import { ArrowLeft, ArrowRight, RotateCw } from "lucide-react";
import { rerunScenario } from "@/app/actions";
import { Answer } from "@/components/answer";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { TraceLedger, TraceMeta } from "@/components/trace";
import type { QuestionStats, Trace } from "@/lib/api";

type Run = { at: Date; trace: Trace };

// The button goes in the card's button row; the result renders below it.
export function useRerun(slug: string, initialStats: QuestionStats | null) {
  const [runs, setRuns] = useState<Run[]>([]);
  const [stats, setStats] = useState<QuestionStats | null>(initialStats);
  const [shown, setShown] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!pending) return;
    const id = window.setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [pending]);

  const run = () => {
    setElapsed(0);
    setError(null);
    start(async () => {
      const result = await rerunScenario(slug);
      if (result.trace) {
        if (result.stats) setStats(result.stats);
        setRuns((prev) => {
          const next = [...prev, { at: new Date(), trace: result.trace! }];
          setShown(next.length - 1);
          return next;
        });
      } else {
        setError(result.error ?? "Something went wrong.");
      }
    });
  };

  return { runs, shown, setShown, error, pending, elapsed, run, stats };
}

export function RerunButton({ pending, elapsed, onClick }: { pending: boolean; elapsed: number; onClick: () => void }) {
  return (
    <Button
      type="button"
      size="lg"
      variant="outline"
      disabled={pending}
      onClick={onClick}
      className="h-11 px-5 font-heading text-base"
    >
      <RotateCw className={pending ? "size-4 animate-spin" : "size-4"} aria-hidden />
      {pending ? `Asking the agent, ${elapsed}s` : "Ask it again now"}
    </Button>
  );
}

export function RerunResult({
  runs,
  shown,
  setShown,
  error,
  merchantId,
}: {
  runs: Run[];
  shown: number;
  setShown: (i: number) => void;
  error: string | null;
  merchantId: number;
}) {
  const [open, setOpen] = useState(false);
  const current = runs[shown];
  if (error) return <p className="mt-4 text-sm text-destructive">{error}</p>;
  if (!current) return null;
  const t = current.trace;
  return (
    <div className="mt-8 border-t pt-8">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="font-heading text-base text-primary">
          Asked again at {current.at.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
        </p>
        {runs.length > 1 && (
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Earlier run" disabled={shown === 0} onClick={() => setShown(shown - 1)}>
              <ArrowLeft className="size-4" aria-hidden />
            </Button>
            <span className="font-sql text-xs">
              run {shown + 1} of {runs.length}
            </span>
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Later run" disabled={shown === runs.length - 1} onClick={() => setShown(shown + 1)}>
              <ArrowRight className="size-4" aria-hidden />
            </Button>
          </div>
        )}
      </div>
      <Answer text={t.answer ?? ""} merchantId={merchantId} className="text-lg leading-relaxed" />
      <div className="mt-6">
        <TraceMeta trace={t} />
      </div>
      <Collapsible open={open} onOpenChange={setOpen} className="mt-6">
        <CollapsibleTrigger asChild>
          <Button size="lg" variant={open ? "outline" : "default"} className="h-11 px-5 font-heading text-base">
            {open ? "Hide the new trace" : "Show the new trace"}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-8">
          <TraceLedger trace={t} />
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

export function QuestionStatsLine({ stats }: { stats: QuestionStats | null }) {
  if (!stats || stats.asked === 0) return null;
  const since = stats.first_asked_at
    ? new Date(stats.first_asked_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    : null;
  const parts = [
    `${stats.answered} answered`,
    stats.cost_median_usd != null ? `typical cost $${stats.cost_median_usd.toFixed(4)}` : null,
    stats.latency_median_ms != null ? `typical time ${(stats.latency_median_ms / 1000).toFixed(1)} s` : null,
  ].filter(Boolean);
  return (
    <p className="mt-2 text-sm text-muted-foreground">
      Asked {stats.asked} {stats.asked === 1 ? "time" : "times"}
      {since ? ` since ${since}` : ""}, by everyone who has opened this page: {parts.join(", ")}.
    </p>
  );
}
