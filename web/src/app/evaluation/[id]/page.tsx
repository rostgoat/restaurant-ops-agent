import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Answer } from "@/components/answer";
import { MerchantBadge } from "@/components/merchant-badge";
import { PageOutline } from "@/components/page-outline";
import { TraceLedger } from "@/components/trace";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TwoQueries } from "@/components/two-queries";
import { RunHistory } from "@/components/every-case";
import { data, describeExpectation, diagnosis, modelQuery, runs, suiteTitle } from "@/lib/evaluation";
import { pageMetadata } from "@/lib/site";
import { count } from "@/lib/format";

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
  const outcomeTone =
    r.grade.outcome === "pass"
      ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
      : r.grade.outcome === "fail"
        ? "border-rose-500/30 bg-rose-500/15 text-rose-700 dark:text-rose-300"
        : "border-amber-500/30 bg-amber-500/15 text-amber-800 dark:text-amber-300";

  return (
    <>
      <PageOutline
        items={[
          { slug: "expectation", title: "What should happen, and what the grader found" },
          ...(c.gold_sql ? [{ slug: "queries", title: "The two queries" }] : []),
          { slug: "answer", title: "What it answered" },
          { slug: "trace", title: "The trace" },
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
        <div>
          <h2 className="mb-2 text-xl">What the grader found</h2>
          <p className="text-lg leading-relaxed">
            <Badge variant="outline" className={`mr-2 font-heading ${outcomeTone}`}>
              {r.grade.outcome}
            </Badge>
            {r.grade.outcome === "pass" ? passLine(r) : null}
          </p>
          {r.grade.reasons.length > 0 && (
            <ul className="mt-3 list-disc space-y-1 pl-5 leading-relaxed">
              {r.grade.reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          )}
          {diagnosis[c.id] && <p className="mt-3 leading-relaxed text-muted-foreground">{diagnosis[c.id]}</p>}
        </div>
      </div>

      {c.gold_sql && (
        <section id="queries" className="mt-12 scroll-mt-28">
          <h2 className="mb-3 text-xl">The two queries</h2>
          <TwoQueries gold={c.gold_sql} model={modelQuery(r.trace)} />
        </section>
      )}

      {r.trace.answer && (
        <section id="answer" className="mt-12 scroll-mt-28">
          <h2 className="mb-3 text-xl">What it answered</h2>
          <Answer text={r.trace.answer} merchantId={c.merchant_id} className="text-lg leading-relaxed" />
        </section>
      )}

      <section id="trace" className="mt-16 scroll-mt-28">
        <h2 className="mb-3 text-2xl">The trace</h2>
        <p className="mb-8 text-lg text-muted-foreground">
          Every step as it ran. Steps marked model were decided by Claude; steps marked code ran as
          fixed logic; a person appears only where someone approved or rejected something.
        </p>
        <TraceLedger trace={r.trace} />
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

function passLine(r: (typeof data.results)[number]): string {
  const { expected, found } = r.grade;

  if (r.case.suite === "sql" && expected !== null && found !== null) {
    return `Found ${figure(found, r.case.value_kind)} against ${figure(expected, r.case.value_kind)} expected.`;
  }
  if (r.case.suite === "policy" && Array.isArray(found) && found.length) {
    return `Cited ${found.join(", ")}.`;
  }
  if (r.case.suite === "propose" && Array.isArray(found)) {
    return `Proposal status: ${found.join(", ") || "none"}.`;
  }
  return `Status: ${String(found ?? "")}.`;
}

function figure(v: unknown, kind: string | undefined): string {
  if (typeof v !== "number") return String(v);

  if (kind === "cents") return v.toLocaleString("en-US", { style: "currency", currency: "USD" });

  if (kind === "pct") return `${v}%`;

  return count(v);
}
