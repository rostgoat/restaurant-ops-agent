import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { MerchantBadge } from "@/components/merchant-badge";
import { PageOutline } from "@/components/page-outline";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RunHistory } from "@/components/every-case";
import { RunViewer } from "@/components/run-viewer";
import { data, describeExpectation, diagnosis, runs, runViews, suiteTitle } from "@/lib/evaluation";
import { pageMetadata } from "@/lib/site";

export async function generateMetadata(props: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await props.params;
  const r = data.results.find((x) => x.case.id === id);
  const title = `Evaluation case ${id}`;
  const description = r
    ? `${r.case.question} Graded ${r.grade.outcome} on the ${r.case.suite} suite, with the full trace.`
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
          { slug: "expectation", title: "What should happen" },
          { slug: "runs", title: "Each run" },
        ]}
      />
      <Button asChild variant="link" className="mb-10 h-auto p-0 font-sans text-sm">
        <Link href="/evaluation">
          <ArrowLeft className="size-4" aria-hidden /> All {data.results.length} cases
        </Link>
      </Button>
      <p className="font-heading text-base text-primary">
        Evaluation case {c.id}, from the {(suiteTitle[c.suite] ?? c.suite).split(":")[0].toLowerCase()} suite
      </p>
      <h1 className="mt-4 text-3xl sm:text-5xl">{c.question}</h1>
      <div className="mt-4">
        <RunHistory id={c.id} runs={runs} />
      </div>
      <p className="mt-4 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        Asked as <MerchantBadge merchantId={c.merchant_id} />
        {(c.tags ?? []).map((t) => (
          <Badge key={t} variant="secondary">
            {t}
          </Badge>
        ))}
      </p>

      <div id="expectation" className="mt-12 grid scroll-mt-28 gap-8 md:grid-cols-2">
        <div>
          <h2 className="mb-2 text-xl">What should happen</h2>
          <p className="text-lg leading-relaxed">{describeExpectation(c)}</p>
          {c.note && <p className="mt-3 leading-relaxed text-muted-foreground">{c.note}</p>}
        </div>
        {diagnosis[c.id] && (
          <div>
            <h2 className="mb-2 text-xl">What the trace shows</h2>
            <p className="text-lg leading-relaxed">{diagnosis[c.id]}</p>
          </div>
        )}
      </div>

      <section id="runs" className="mt-12 scroll-mt-28">
        <h2 className="mb-3 text-2xl">Each run</h2>
        <p className="mb-8 text-lg text-muted-foreground">
          Pick a run to see what the grader found, what the model answered, and every step as it
          ran. Steps marked model were decided by Claude; steps marked code ran as fixed logic; a
          person appears only where someone approved or rejected something.
        </p>
        <RunViewer views={runViews(c.id)} merchantId={c.merchant_id} goldSql={c.gold_sql} large traceOpen />
      </section>

      <nav className="mt-20 flex justify-between gap-4 border-t pt-8">
        {prev ? (
          <Button asChild variant="ghost" className="h-auto px-0 py-2 font-heading text-base">
            <Link href={`/evaluation/${prev.case.id}`}>
              <ArrowLeft className="size-5" aria-hidden /> {prev.case.id}
            </Link>
          </Button>
        ) : (
          <span />
        )}
        {next ? (
          <Button asChild variant="ghost" className="h-auto px-0 py-2 font-heading text-base">
            <Link href={`/evaluation/${next.case.id}`}>
              {next.case.id} <ArrowRight className="size-5" aria-hidden />
            </Link>
          </Button>
        ) : (
          <span />
        )}
      </nav>
    </>
  );
}
