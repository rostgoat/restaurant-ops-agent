"use client";

import { useState, useTransition } from "react";
import { RotateCw } from "lucide-react";
import { rerunScenario, type RerunState } from "@/app/actions";
import { Answer } from "@/components/answer";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { TraceLedger, TraceMeta } from "@/components/trace";

export function RerunScenario({ slug, merchantId, capturedOn }: { slug: string; merchantId: number; capturedOn: string }) {
  const [state, setState] = useState<RerunState | null>(null);
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const t = state?.trace;
  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          size="lg"
          variant="outline"
          disabled={pending}
          onClick={() => start(async () => setState(await rerunScenario(slug)))}
          className="h-11 px-5 font-heading text-base"
        >
          <RotateCw className={pending ? "size-4 animate-spin" : "size-4"} aria-hidden />
          {pending ? "Asking the agent now" : "Ask it again now"}
        </Button>
        <span className="text-sm text-muted-foreground">
          The answer above was captured on {capturedOn}. This asks the same question live. It costs a
          few cents and takes about ten seconds.
        </span>
      </div>
      {state?.error && <p className="mt-4 text-sm text-destructive">{state.error}</p>}
      {t && (
        <div className="mt-8 border-t pt-8">
          <p className="mb-3 font-heading text-base text-primary">Asked again just now</p>
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
      )}
    </div>
  );
}
