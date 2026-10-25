import Link from "next/link";
import { Kicker } from "@/components/kicker";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FailureCard } from "@/components/failure-card";
import { MerchantBadge } from "@/components/merchant-badge";
import { StatusBadge } from "@/components/trace";
import { count, dollars, seconds } from "@/lib/format";
import { compare, data, describeExpectation, diagnosis, errors, failures, suiteTitle, type Compare } from "@/lib/evaluation";

const QUESTIONS_PER_DAY = 20;

export const metadata = { title: "Evaluation" };

export default function EvaluationPage() {
  const s = data.summary;
  const low = compare.runs.find((r) => r.effort === "low");
  const t040 = compare.runs.find((r) => r.retrieval_threshold === 0.4);
  const t060 = compare.runs.find((r) => r.retrieval_threshold === 0.6);
  const when = new Date(s.ran_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const rate = s.scored ? Math.round((100 * s.passed) / s.scored) : 0;
  const perMonth = s.cost_per_answered_median_usd !== null ? s.cost_per_answered_median_usd * QUESTIONS_PER_DAY * 30 : null;
  return (
    <>
      <section>
        <Kicker page="Evaluation" />
        <h1 className="mt-4 max-w-[30ch] text-5xl sm:text-6xl">
          {s.cases} questions, graded by code. {s.passed} pass.
        </h1>
        <p className="mt-8 text-xl leading-relaxed text-muted-foreground">
          The{" "}
          <Link href="/scenarios" className="text-primary underline-offset-4 hover:underline">
            scenarios
          </Link>{" "}
          are stories. Evaluation is the measurement behind them: {s.cases} questions with the
          right answer written down in advance, passed through the same agent against a frozen copy
          of the data, and graded by code.
          {failures.length === 1 ? " The one case that fails is shown in full below." : failures.length > 1 ? ` The ${failures.length} cases that fail are shown in full below.` : ""}
        </p>
        <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
          Last run {when}. A SQL answer must contain the figure a hand-written query returns
          from that database. A policy answer must cite the section the author named and nothing
          borrowed from the other restaurant. A refusal or a proposal is graded on what the trace
          records.
        </p>
      </section>

      <section className="mt-16 grid gap-8 sm:grid-cols-3">
        <Figure value={`${rate}%`} label={`${s.passed} of ${s.scored} cases pass${s.errors ? `; ${s.errors} ended in an error that is not the model's` : ""}`} />
        <Figure value={s.cost_per_answered_median_usd !== null ? dollars(s.cost_per_answered_median_usd) : "n/a"} label={`typical cost of an answer on ${s.model}; nine in ten cost under ${s.cost_per_answered_p90_usd !== null ? dollars(s.cost_per_answered_p90_usd) : "n/a"}`} />
        <Figure value={perMonth !== null ? `$${perMonth.toFixed(2)}` : "n/a"} label={`per restaurant per month at ${QUESTIONS_PER_DAY} questions a day, an assumption, not a measurement`} />
      </section>

      <EveryCase />

      <FailuresSection />

      <section className="mt-24">
        <h2 className="mb-6 text-3xl">By suite</h2>
        <Table className="max-w-3xl">
          <TableHeader>
            <TableRow>
              <TableHead>Suite</TableHead>
              <TableHead className="text-right">Passed</TableHead>
              <TableHead className="text-right">Of</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Object.entries(s.suites).map(([suite, v]) => (
              <TableRow key={suite}>
                <TableCell className="whitespace-normal">{suiteTitle[suite] ?? suite}</TableCell>
                <TableCell className="text-right font-sql">{v.passed}</TableCell>
                <TableCell className="text-right font-sql">{v.total}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <p className="mt-4 text-sm text-muted-foreground">
          Retrieval, over the policy cases: {fmt(s.retrieval.precision)} of the sections shown to
          the model were ones the author expected, and {fmt(s.retrieval.recall)} of the expected
          sections were shown, at a similarity threshold of {s.retrieval_threshold}. A typical
          answer takes {seconds(s.latency_median_ms ?? 0)}; nine in ten take under{" "}
          {seconds(s.latency_p90_ms ?? 0)}.
        </p>
      </section>

      {compare.runs.length > 1 && (
        <section className="mt-24">
          <h2 className="mb-6 text-3xl">Other models, efforts and thresholds</h2>
          <p className="mb-6 text-lg leading-relaxed text-muted-foreground">
            The first row is the run this page reports. Each other row changes one setting: the
            model, the effort, or the retrieval threshold. The threshold is the similarity score a
            policy section needs before the model sees it. Threshold runs cover the{" "}
            {s.suites.policy?.total ?? 0} policy cases only.
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Run</TableHead>
                <TableHead className="text-right">Pass</TableHead>
                <TableHead className="text-right">SQL</TableHead>
                <TableHead className="text-right">Policy</TableHead>
                <TableHead className="text-right">Proposals</TableHead>
                <TableHead className="max-w-[7rem] text-right whitespace-normal">Retrieval precision / recall</TableHead>
                <TableHead className="max-w-[6rem] text-right whitespace-normal">Cost per answer</TableHead>
                <TableHead className="max-w-[6rem] text-right whitespace-normal">Time per answer</TableHead>
                <TableHead className="max-w-[5rem] text-right whitespace-normal">Whole run</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {compare.runs.map((r) => (
                <TableRow key={r.label}>
                  <TableCell className="whitespace-nowrap">{runName(r)}</TableCell>
                  <TableCell className="text-right font-sql">
                    {r.passed}/{r.scored}
                  </TableCell>
                  <TableCell className="text-right font-sql">{suiteCell(r.suites.sql)}</TableCell>
                  <TableCell className="text-right font-sql">{suiteCell(r.suites.policy)}</TableCell>
                  <TableCell className="text-right font-sql">{suiteCell(r.suites.propose)}</TableCell>
                  <TableCell className="text-right font-sql">
                    {fmt(r.retrieval.precision)} / {fmt(r.retrieval.recall)}
                  </TableCell>
                  <TableCell className="text-right font-sql">
                    {r.cost_per_answered_median_usd !== null ? dollars(r.cost_per_answered_median_usd) : "n/a"}
                  </TableCell>
                  <TableCell className="text-right font-sql">{seconds(r.latency_median_ms ?? 0)}</TableCell>
                  <TableCell className="text-right font-sql">{dollars(r.cost_total_usd)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Differences />
          <div className="mt-10 space-y-4 text-lg leading-relaxed text-muted-foreground">
            <p>
              <strong className="text-foreground">The model is not the bottleneck.</strong> Low
              effort passed {`${low?.passed ?? "?"} of ${low?.scored ?? "?"}`}, medium passed{" "}
              {`${s.passed} of ${s.scored}`}. The one-case gap is a wording flip, not a reasoning gap. A bigger model
              would not have changed these results.
            </p>
            <p>
              <strong className="text-foreground">Retrieval is.</strong> Both failures on the main
              run are the same failure. The right section exists, scored 0.38 to 0.49 against the
              model&apos;s search, and the threshold was {s.retrieval_threshold}. Shown nothing, the
              model said the policy was silent. That is the failure to worry about, because it reads
              like a careful answer.
            </p>
            <p>
              <strong className="text-foreground">Set the threshold low.</strong> At 0.40 the model
              sees {fmt(t040?.retrieval.recall ?? null)} of the right sections and some wrong ones.
              At 0.60 it sees {fmt(t060?.retrieval.recall ?? null)} of the right ones, and four
              discount cases fail together when one section drops below the bar. A hidden section
              produces a confident wrong answer; an extra section gets ignored. The range is 0.40
              to 0.50.
            </p>
            <p>
              <strong className="text-foreground">What this cannot tell you.</strong> Each setting
              ran once, and the model words its own searches, so a one-case difference between
              settings is noise. Running each setting several times would give a pass rate with a
              spread, and that is the next measurement.
            </p>
          </div>
        </section>
      )}

      <section className="mt-24">
        <h2 className="mb-6 text-3xl">Limitations</h2>
        <div className="space-y-4 text-lg leading-relaxed text-muted-foreground">
          <p>
            Every case runs through the same entry point the site uses, with the same prompt,
            tools, model, and settings, and the full trace is kept so a surprising grade can be
            traced to the step that caused it. A case whose request errored is reported
            separately, never as a model failure.
          </p>
          <p>
            The SQL grader looks for the expected figure, within a small tolerance, among the numbers
            in the answer. It cannot tell a right answer from a right number arrived at by the
            wrong query, and it cannot tell a wrong answer from a right one phrased without the
            number. The policy grader checks citations and a few phrases, not whether the
            explanation is sound. {s.cases} cases is enough to catch regressions, not to estimate
            a rate to the point.
          </p>
          <p>
            One run of each setting. The comparison above shows the run-to-run swing is real: the
            same policy case passes on one run and fails on the next when the model words its
            search differently. The harness supports repetitions, and a pass rate with a spread is
            the next number to add. Ground truth: {s.ground_truth}
          </p>
          <p>
            Run on commit {s.commit ?? "unknown"}, model {s.model} at {s.effort} effort, dataset{" "}
            {s.dataset}, with the clock frozen at {s.frozen_now.slice(0, 10)}. The run file with
            every trace is in the repository under api/evals/runs. The{" "}
            <Link href="/scenarios" className="text-primary underline-offset-4 hover:underline">
              scenarios
            </Link>{" "}
            are the readable version of the same idea.
          </p>
        </div>
      </section>
    </>
  );
}

function EveryCase() {
  return (
      <section className="mt-24">
        <h2 className="mb-6 text-3xl">Every case</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Case</TableHead>
              <TableHead>Question</TableHead>
              <TableHead>Asked as</TableHead>
              <TableHead>Result</TableHead>
              <TableHead className="text-right">Time</TableHead>
              <TableHead className="text-right">Cost</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.results.map((r) => (
              <TableRow key={r.case.id}>
                <TableCell className="font-sql text-xs">
                  <Link href={`/evaluation/${r.case.id}`} className="text-primary underline-offset-4 hover:underline">
                    {r.case.id}
                  </Link>
                </TableCell>
                <TableCell className="whitespace-normal">{r.case.question}</TableCell>
                <TableCell className="whitespace-nowrap">
                  <MerchantBadge merchantId={r.case.merchant_id} />
                </TableCell>
                <TableCell>
                  <OutcomeBadge outcome={r.grade.outcome} />{" "}
                  <StatusBadge status={r.trace.status} />
                </TableCell>
                <TableCell className="text-right font-sql text-[13px]">{seconds(r.trace.latency_ms)}</TableCell>
                <TableCell className="text-right font-sql text-[13px]">{dollars(r.trace.cost_usd)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>
  );
}

function FailuresSection() {
  return (
      <section className="mt-24">
        <h2 className="mb-6 text-3xl">
          {failures.length === 0 ? "No failures" : failures.length === 1 ? "The one failure" : `The ${failures.length} failures`}
        </h2>
        {failures.length === 0 ? (
          <p className=" text-lg text-muted-foreground">
            Every scored case passed on this run. That is a small set; it says the floor holds,
            not that the agent is right in general.
          </p>
        ) : (
          <div className="space-y-12">
            {failures.map((r) => (
              <FailureCard
                key={r.case.id}
                id={r.case.id}
                suite={suiteTitle[r.case.suite] ?? r.case.suite}
                tags={r.case.tags ?? []}
                merchantId={r.case.merchant_id}
                question={r.case.question}
                expected={describeExpectation(r.case)}
                reasons={r.grade.reasons}
                diagnosis={diagnosis[r.case.id]}
                trace={r.trace}
              />
            ))}
          </div>
        )}
        {errors.length > 0 && (
          <p className="mt-8 text-sm text-muted-foreground">
            {errors.length} {errors.length === 1 ? "case" : "cases"} ended in an error from the API
            or the harness and {errors.length === 1 ? "is" : "are"} left out of the pass rate rather
            than counted against the model: {errors.map((r) => r.case.id).join(", ")}.
          </p>
        )}
      </section>
  );
}

function Figure({ value, label }: { value: string; label: string }) {
  return (
    <div className="border-t pt-4">
      <p className="font-heading text-3xl">{value}</p>
      <p className="mt-1 text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

function suiteCell(v: { passed: number; total: number } | undefined) {
  return v ? `${v.passed}/${v.total}` : "–";
}

function Differences() {
  const main = compare.runs[0];
  const models = compare.runs.filter((r) => r.retrieval_threshold === main.retrieval_threshold);
  const thresholds = compare.runs
    .filter((r) => r.model === main.model && r.effort === main.effort)
    .sort((a, b) => a.retrieval_threshold - b.retrieval_threshold);
  return (
    <div className="mt-10 space-y-12">
      <h3 className="text-2xl">Where the runs disagree</h3>
      <DisagreementTable
        title="Model and effort"
        intro="Each column is one run of every case with a different model or effort, all at the 0.50 threshold. Only cases with mixed results are listed."
        runs={models}
        header={(r) => `${modelName(r.model)}, ${r.effort} effort`}
      />
      <DisagreementTable
        title="Retrieval threshold"
        intro="Each column is one run of the policy cases on Sonnet 5.5 at medium effort with a different threshold. Only cases with mixed results are listed."
        runs={thresholds}
        header={(r) => r.retrieval_threshold.toFixed(2)}
      />
    </div>
  );
}

function DisagreementTable({
  title,
  intro,
  runs,
  header,
}: {
  title: string;
  intro: string;
  runs: Compare["runs"];
  header: (r: Compare["runs"][number]) => string;
}) {
  const labels = runs.map((r) => r.label);
  const rows = compare.cases.filter((c) => {
    const seen = new Set(labels.map((l) => c.outcomes[l]?.outcome).filter(Boolean));
    return seen.size > 1;
  });
  return (
    <div>
      <h3 className="mb-2 text-xl">{title}</h3>
      <p className="mb-4 text-base text-muted-foreground">
        {intro}
        {rows.length === 0 && " None here: every case had the same result in every column."}
      </p>
      {rows.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Case</TableHead>
              {runs.map((r) => (
                <TableHead key={r.label} className="px-2 text-center whitespace-nowrap">
                  {header(r)}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="w-[52%] whitespace-normal py-4 align-top">
                  <p className="text-base leading-relaxed">
                    <Link href={`/evaluation/${c.id}`} className="font-sql text-xs text-primary underline-offset-4 hover:underline">
                      {c.id}
                    </Link>{" "}
                    {c.question}
                  </p>
                  {diagnosis[c.id] && (
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {diagnosis[c.id]}
                    </p>
                  )}
                </TableCell>
                {runs.map((r) => {
                  const o = c.outcomes[r.label];
                  return (
                    <TableCell key={r.label} className="px-2 text-center align-top">
                      {o ? (
                        <OutcomeBadge outcome={o.outcome} />
                      ) : (
                        <span className="text-xs text-muted-foreground">not run</span>
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

function runName(r: Compare["runs"][number]): string {
  const main = compare.runs[0];
  if (r.retrieval_threshold !== main.retrieval_threshold) {
    return `${r.retrieval_threshold.toFixed(2)}, policy cases`;
  }
  return `${modelName(r.model)}, ${r.effort} effort${r === main ? `, threshold ${r.retrieval_threshold.toFixed(2)}` : ""}`;
}

function modelName(id: string): string {
  return id.replace("claude-", "").replace("-5-5", " 5.5").replace(/^\w/, (c) => c.toUpperCase());
}

function OutcomeBadge({ outcome }: { outcome: string }) {
  const tone =
    outcome === "pass"
      ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
      : outcome === "fail"
        ? "border-rose-500/30 bg-rose-500/15 text-rose-700 dark:text-rose-300"
        : "border-amber-500/30 bg-amber-500/15 text-amber-800 dark:text-amber-300";
  return (
    <Badge variant="outline" className={`font-heading ${tone}`}>
      {outcome}
    </Badge>
  );
}

function fmt(v: number | null) {
  return v === null ? "n/a" : `${Math.round(v * 100)}%`;
}

export { count };
