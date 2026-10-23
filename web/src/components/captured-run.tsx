import { TraceLedger } from "@/components/trace";
import type { Trace } from "@/lib/api";
import captured from "@/content/captured-trace.json";

const trace = captured as Trace;

export function CapturedRun() {
  const when = new Date(trace.created_at).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  return (
    <section className="mt-32">
      <h2 className="mb-4 text-3xl">One request, as it ran</h2>
      <p className="mb-10 max-w-[60ch] text-lg text-muted-foreground">
        Captured on {when} from a real run with {trace.model}, asked as the owner of a
        fictional noodle house. Nothing below is edited.
      </p>
      <h3 className="mb-6 text-2xl">{trace.question}</h3>
      <TraceLedger trace={trace} />
    </section>
  );
}
