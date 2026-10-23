import Link from "next/link";
import { notFound } from "next/navigation";
import { TraceLedger } from "@/components/trace";
import { getTrace } from "@/lib/api";
import { currentMerchant } from "@/lib/merchant";

export const instant = false;

export default async function TracePage(props: PageProps<"/traces/[id]">) {
  const { id } = await props.params;
  const trace = await getTrace(id, await currentMerchant());
  if (!trace) notFound();
  return (
    <>
      <p className="mb-6 text-sm">
        <Link href="/" className="underline underline-offset-4">
          Ask
        </Link>
      </p>
      <h1 className="text-3xl mb-1">{trace.question}</h1>
      <p className="mb-6 text-sm text-muted">
        Asked {new Date(trace.created_at).toLocaleString("en-US")} with {trace.model}.
      </p>
      <TraceLedger trace={trace} />
    </>
  );
}
