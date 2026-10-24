import Link from "next/link";
import { notFound } from "next/navigation";
import { TraceLedger } from "@/components/trace";
import { Button } from "@/components/ui/button";
import { getTrace } from "@/lib/api";
import { currentMerchant } from "@/lib/merchant";

export const instant = false;

export default async function TracePage(props: PageProps<"/traces/[id]">) {
  const { id } = await props.params;
  const trace = await getTrace(id, await currentMerchant());
  if (!trace) notFound();
  return (
    <>
      <Button asChild variant="link" className="mb-10 h-auto p-0 font-sans text-sm">
        <Link href="/ask">Ask another question</Link>
      </Button>
      <h1 className="mb-3 text-4xl">{trace.question}</h1>
      <p className="mb-12 text-sm text-muted-foreground">
        Asked {new Date(trace.created_at).toLocaleString("en-US")} with {trace.model}.
      </p>
      <TraceLedger trace={trace} />
    </>
  );
}
