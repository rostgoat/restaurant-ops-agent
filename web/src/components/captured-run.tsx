import { TraceLedger } from "@/components/trace";
import type { Trace } from "@/lib/api";

export function CapturedRun({ trace, lead }: { trace: Trace; lead?: string }) {
  return (
    <div>
      {lead && <p className="mb-6 max-w-[60ch] text-lg text-muted-foreground">{lead}</p>}
      <h3 className="mb-6 text-2xl">{trace.question}</h3>
      <TraceLedger trace={trace} />
    </div>
  );
}

export function capturedOn(trace: Trace): string {
  return new Date(trace.created_at).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
