import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { MerchantBadge } from "@/components/merchant-badge";
import { PageOutline } from "@/components/page-outline";
import { Button } from "@/components/ui/button";
import { RunViewer } from "@/components/run-viewer";
import { data, describeExpectation, runViews, suiteTitle } from "@/lib/evaluation";
import { pageMetadata } from "@/lib/site";

export async function generateMetadata(props: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await props.params;
  const r = data.results.find((x) => x.case.id === id);
  const title = `Evaluation test ${id}`;
  const description = r
    ? `${r.case.question} Expected result, results from each run, and a record of the agent’s steps.`
    : title;

  return pageMetadata(title, description, `/evaluation/${id}`);
}

export function generateStaticParams() {
  return data.results.map((r) => ({ id: r.case.id }));
}

export default async function CasePage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const index = data.results.findIndex((r) => r.case.id === id);

  if (index < 0) notFound();
  const r = data.results[index];
  const prev = data.results[index - 1];
  const next = data.results[index + 1];
  const c = r.case as typeof r.case & { note?: string };
  return (
    <>
      <PageOutline
        items={[
          { slug: "expectation", title: "Expected result" },
          { slug: "runs", title: "Results by run" },
        ]}
      />
      <Button asChild variant="link" className="mb-10 h-auto p-0 font-sans text-sm">
        <Link href="/evaluation">
          <ArrowLeft className="size-4" aria-hidden /> All {data.results.length} tests
        </Link>
      </Button>
      <p className="font-heading text-base text-primary">
        Test {c.id} · {(suiteTitle[c.suite] ?? c.suite).split(":")[0]}
      </p>
      <h1 className="mt-4 text-3xl sm:text-5xl">{c.question}</h1>
      <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
        Restaurant: <MerchantBadge merchantId={c.merchant_id} />
      </p>

      <div id="expectation" className="mt-12 max-w-[70ch] scroll-mt-28">
        <h2 className="mb-2 text-xl">Expected result</h2>
        <p className="text-lg leading-relaxed">{describeExpectation(r)}</p>
        {c.note && <p className="mt-3 leading-relaxed text-muted-foreground">{c.note}</p>}
      </div>

      <section id="runs" className="mt-12 scroll-mt-28">
        <h2 className="mb-3 text-2xl">Results by run</h2>
        <p className="mb-8 text-lg text-muted-foreground">
          Choose a run to see its grading result, the agent’s answer, and the recorded steps.
          “Model” marks a response or tool request from Claude. “Code” marks a check or operation
          performed by the application. “Human” marks a person’s approval or rejection of a
          proposed action.
        </p>
        <RunViewer views={runViews(c.id)} merchantId={c.merchant_id} goldSql={c.gold_sql} large traceOpen />
      </section>

      <nav className="mt-20 flex justify-between gap-4 border-t pt-8">
        {prev ? (
          <Button asChild variant="ghost" className="h-auto px-0 py-2 font-heading text-base">
            <Link href={`/evaluation/${prev.case.id}`}>
              <ArrowLeft className="size-5" aria-hidden /> Previous: {prev.case.id}
            </Link>
          </Button>
        ) : (
          <span />
        )}
        {next ? (
          <Button asChild variant="ghost" className="h-auto px-0 py-2 font-heading text-base">
            <Link href={`/evaluation/${next.case.id}`}>
              Next: {next.case.id} <ArrowRight className="size-5" aria-hidden />
            </Link>
          </Button>
        ) : (
          <span />
        )}
      </nav>
    </>
  );
}
