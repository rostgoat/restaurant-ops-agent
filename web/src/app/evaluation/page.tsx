import Link from "next/link";
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
import { StatusBadge } from "@/components/trace";
import type { Trace } from "@/lib/api";
import { count, dollars, seconds } from "@/lib/format";
import run from "@/content/eval-run.json";

type Result = {
  case: {
    id: string;
    suite: string;
    merchant_id: number;
    question: string;
    tags?: string[];
    value_kind?: string;
  };
  gold: unknown;
  grade: { outcome: string; reasons: string[]; expected: unknown; found: unknown };
  trace: Trace;
};

type Run = {
  summary: {
    ran_at: string;
    model: string;
    effort: string;
    retrieval_threshold: number;
    commit: string | null;
    dataset: string;
    frozen_now: string;
    ground_truth: string;
    cases: number;
    scored: number;
    passed: number;
    errors: number;
    suites: Record<string, { passed: number; total: number }>;
    cost_total_usd: number;
    cost_per_answered_median_usd: number | null;
    cost_per_answered_p90_usd: number | null;
    latency_median_ms: number | null;
    latency_p90_ms: number | null;
    retrieval: { precision: number | null; recall: number | null; sections_shown: number; sections_expected: number };
  };
  results: Result[];
};

const data = run as unknown as Run;

const suiteTitle: Record<string, string> = {
  sql: "SQL: is the figure right?",
  policy: "Policy: the right section, cited, and nothing borrowed",
  refuse: "Refusals: hostile or out-of-scope questions",
  answer: "Plain questions: answered without over-reaching",
  propose: "Proposals: checked by code before a person sees them",
};

const QUESTIONS_PER_DAY = 20;

export default function EvaluationPage() {
  const s = data.summary;
  const when = new Date(s.ran_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const rate = s.scored ? Math.round((100 * s.passed) / s.scored) : 0;
  const failures = data.results.filter((r) => r.grade.outcome === "fail");
  const errors = data.results.filter((r) => r.grade.outcome === "error");
  const perMonth = s.cost_per_answered_median_usd !== null ? s.cost_per_answered_median_usd * QUESTIONS_PER_DAY * 30 : null;
  return (
    <>
      <section>
        <p className="font-heading text-base text-primary">Applied AI case study</p>
        <h1 className="mt-4 max-w-[30ch] text-5xl sm:text-6xl">
          {s.passed} of {s.scored} cases pass. Here is every one that does not.
        </h1>
        <p className="mt-8 max-w-[76ch] text-xl leading-relaxed text-muted-foreground">
          The five scenarios are stories you can read. This page is the measurement behind
          them: {s.cases} separate questions, each with a right answer written down in advance,
          run through the same agent and graded by code, against a frozen copy of the data so
          the number means the same thing next month. It is how the project knows a change to
          the prompt, the model, or a policy made things better rather than merely different.
        </p>
        <p className="mt-4 max-w-[76ch] text-lg leading-relaxed text-muted-foreground">
          Last run {when}. SQL cases are graded against a gold query run on that database;
          policy cases against the section the author identified; refusals and proposals against
          what the trace records. No model grades another model.
        </p>
      </section>

      <section className="mt-16 grid max-w-4xl gap-8 sm:grid-cols-3">
        <Figure value={`${rate}%`} label={`${s.passed} of ${s.scored} scored cases pass; ${s.errors} ended in an error that is not the model's`} />
        <Figure value={s.cost_per_answered_median_usd !== null ? dollars(s.cost_per_answered_median_usd) : "n/a"} label={`median cost per answered question on ${s.model}; p90 ${s.cost_per_answered_p90_usd !== null ? dollars(s.cost_per_answered_p90_usd) : "n/a"}`} />
        <Figure value={perMonth !== null ? `$${perMonth.toFixed(2)}` : "n/a"} label={`per merchant per month at ${QUESTIONS_PER_DAY} questions a day, an assumption, not a measurement`} />
      </section>

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
        <p className="mt-4 max-w-[68ch] text-sm text-muted-foreground">
          Retrieval, over the policy cases: precision {fmt(s.retrieval.precision)}, recall{" "}
          {fmt(s.retrieval.recall)} of the sections the author expected, at a similarity threshold
          of {s.retrieval_threshold}. Median latency {seconds(s.latency_median_ms ?? 0)}, p90{" "}
          {seconds(s.latency_p90_ms ?? 0)}.
        </p>
      </section>

      <section className="mt-24">
        <h2 className="mb-6 text-3xl">
          {failures.length === 0 ? "No failures" : failures.length === 1 ? "The one failure" : `The ${failures.length} failures`}
        </h2>
        {failures.length === 0 ? (
          <p className="max-w-[68ch] text-lg text-muted-foreground">
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
                trace={r.trace}
              />
            ))}
          </div>
        )}
        {errors.length > 0 && (
          <p className="mt-8 max-w-[68ch] text-sm text-muted-foreground">
            {errors.length} {errors.length === 1 ? "case" : "cases"} ended in an error from the API
            or the harness and {errors.length === 1 ? "is" : "are"} left out of the pass rate rather
            than counted against the model: {errors.map((r) => r.case.id).join(", ")}.
          </p>
        )}
      </section>

      <section className="mt-24">
        <h2 className="mb-6 text-3xl">Every case</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Case</TableHead>
              <TableHead>Question</TableHead>
              <TableHead>Asked as</TableHead>
              <TableHead>Result</TableHead>
              <TableHead className="text-right">Cost</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.results.map((r) => (
              <TableRow key={r.case.id}>
                <TableCell className="font-sql text-xs">{r.case.id}</TableCell>
                <TableCell className="whitespace-normal">{r.case.question}</TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {r.case.merchant_id === 1 ? "Mekong" : "Ridgeline"}
                </TableCell>
                <TableCell>
                  <Badge variant={r.grade.outcome === "pass" ? "secondary" : "outline"} className="font-heading">
                    {r.grade.outcome}
                  </Badge>{" "}
                  <StatusBadge status={r.trace.status} />
                </TableCell>
                <TableCell className="text-right font-sql text-[13px]">{dollars(r.trace.cost_usd)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>

      <section className="mt-24 max-w-[68ch]">
        <h2 className="mb-6 text-3xl">What this does and does not measure</h2>
        <div className="space-y-4 text-lg leading-relaxed text-muted-foreground">
          <p>
            Every case runs through the same entry point the site uses, with the same prompt,
            tools, model, and settings, and the full trace is kept so a surprising grade can be
            traced to the step that caused it. A case whose request errored is reported
            separately, never as a model failure.
          </p>
          <p>
            The SQL grader looks for the gold figure, within a small tolerance, among the numbers
            in the answer. It cannot tell a right answer from a right number arrived at by the
            wrong query, and it cannot tell a wrong answer from a right one phrased without the
            number. The policy grader checks citations and a few phrases, not whether the
            explanation is sound. Thirty cases is enough to catch regressions, not to estimate a
            rate to the point.
          </p>
          <p>
            One run, one repetition. Run-to-run variance has not been measured yet; the harness
            supports repetitions and that is the next number to add. Ground truth: {s.ground_truth}
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

function Figure({ value, label }: { value: string; label: string }) {
  return (
    <div className="border-t pt-4">
      <p className="font-heading text-3xl">{value}</p>
      <p className="mt-1 text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

function fmt(v: number | null) {
  return v === null ? "n/a" : `${Math.round(v * 100)}%`;
}

function describeExpectation(c: Result["case"] & Record<string, unknown>): string {
  switch (c.suite) {
    case "sql":
      return "Answered, with the gold figure from the database appearing in the answer.";
    case "policy":
      return c.retrieval_empty
        ? "Answered without citing anything, because no section of this restaurant's policies applies."
        : `Answered, citing ${(c.expected_citations as string[] | undefined)?.join(", ") ?? "the right section"}.`;
    case "refuse":
      return "Declined or blocked, without any query reaching the database.";
    case "answer":
      return "Answered plainly, without searching the policies.";
    case "propose":
      return c.proposal_status === "pending"
        ? `A ${String(c.proposal_kind).replace("_", " ")} proposal left pending for a person.`
        : `No ${String(c.proposal_kind).replace("_", " ")} proposal left pending: either not proposed, or blocked by code.`;
    default:
      return "";
  }
}

export { count };
