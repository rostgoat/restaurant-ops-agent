import Link from "next/link";
import { Kicker } from "@/components/kicker";
import { pageMetadata } from "@/lib/site";
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
import { PageOutline } from "@/components/page-outline";
import { MerchantBadge } from "@/components/merchant-badge";
import { StatusBadge } from "@/components/trace";
import { count, dollars, seconds } from "@/lib/format";
import {
  changelog,
  data,
  describeExpectation,
  diagnosis,
  errors,
  failed,
  headline,
  modelQuery,
  suite,
  suiteTitle,
  type Result,
} from "@/lib/evaluation";

const QUESTIONS_PER_DAY = 20;

export const metadata = pageMetadata(
  "Evaluation",
  `${data.summary.cases} questions with a known right answer, graded by code, run after run. Where a wrong answer is caught, where it is only measured, and where it is not.`,
  "/evaluation",
);

const outline = [
  { slug: "runs", title: "The runs" },
  { slug: "meaning", title: "Does it read a word the owner's way?" },
  { slug: "retrieval", title: "Does it find the right rule?" },
  { slug: "citations", title: "Does it cite only what it was shown?" },
  { slug: "actions", title: "Does code hold the line on actions?" },
  { slug: "model", title: "Would a bigger model help?" },
  { slug: "every-case", title: "Every case" },
  { slug: "limitations", title: "Limitations" },
];

export default function EvaluationPage() {
  const s = data.summary;
  const rate = s.scored ? Math.round((100 * s.passed) / s.scored) : 0;
  const perMonth = s.cost_per_answered_median_usd !== null ? s.cost_per_answered_median_usd * QUESTIONS_PER_DAY * 30 : null;
  const sql = suite("sql");
  const policy = suite("policy");
  const propose = suite("propose");
  const guarded = [...suite("refuse"), ...suite("tenant"), ...suite("answer")];

  return (
    <>
      <PageOutline items={outline} />
      <section>
        <Kicker page="Evaluation" />
        <h1 className="mt-4 max-w-[36ch] text-4xl sm:text-6xl">
          I built an agent that answers a restaurant owner&apos;s questions. Then I tried to find out
          what happens when it is wrong.
        </h1>
        <p className="mt-8 text-xl leading-relaxed text-muted-foreground">
          Three kinds of wrong turned up. An action that breaks a rule is caught by code before
          anyone sees it. A query that is safe but answers the wrong question is not caught by
          anything, so I measure how often it happens. A cited section that does not support the
          answer is neither caught nor measured yet. This page is the record of finding that out,
          one run at a time, with the numbers.
        </p>
        <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
          The{" "}
          <Link href="/scenarios" className="text-primary underline-offset-4 hover:underline">
            scenarios
          </Link>{" "}
          are stories. This is the experiment behind them: {s.cases} questions with the right
          answer written down before the model sees them, the same agent and the same prompt as the
          site, a frozen copy of the data, and code doing the grading. I run it again after every
          change, and each run is an entry below with what changed, what the score did, and what I
          concluded.
        </p>
      </section>

      <Runs />

      <section className="mt-16 grid gap-8 sm:grid-cols-3">
        <Figure value={`${rate}%`} label={`${s.passed} of ${s.scored} cases pass on the latest run${s.errors ? `; ${s.errors} ended in an error that is not the model's` : ""}`} />
        <Figure value={s.cost_per_answered_median_usd !== null ? dollars(s.cost_per_answered_median_usd) : "n/a"} label={`typical cost of an answer on ${s.model}; nine in ten cost under ${s.cost_per_answered_p90_usd !== null ? dollars(s.cost_per_answered_p90_usd) : "n/a"}`} />
        <Figure value={perMonth !== null ? `$${perMonth.toFixed(2)}` : "n/a"} label={`per restaurant per month at ${QUESTIONS_PER_DAY} questions a day, an assumption, not a measurement`} />
      </section>

      <Experiment
        slug="meaning"
        title="Does it read a word the owner's way?"
        question="A query can pass all eight safety checks and still answer a different question from the one the owner asked. I wanted to know how often that happens, because nothing in the system would tell me."
        ran={`${sql.length} questions where a word has to be read the owner's way: lunch, regular, summer, lift, net payout. For each one I wrote the query myself, ran it on the frozen database, and kept the figure. The model never sees my query. The grader reads every number in the model's answer and passes the case if one of them is within tolerance of mine.`}
        found={`${passed(sql)} of ${sql.length}. The miss is a query that converted time zones in the wrong direction on a retry after a timeout, so September started five hours early. It passed the guard, ran clean, and came back $2.49 against my $2.64.`}
        decided="Nothing catches this at runtime, and nothing in the guard could, because the query is safe. So I measure it instead of pretending to enforce it, and I put my query beside the model's on every case so a reader can see where the two read a word differently. The cost is that the measurement is only as good as the ten questions, and I wrote them."
      >
        <SqlTable results={sql} />
        <Failures results={sql} />
      </Experiment>

      <Experiment
        slug="retrieval"
        title="Does it find the right rule?"
        question="When the owner asks what is allowed, the model searches their policies and only sees sections that score above a similarity threshold. If the right section scores under the line, the model is told nothing matched and answers as if there is no rule. I wanted to know how often that happens."
        ran={`${policy.length} policy questions, each with the section I expect cited. The threshold is ${s.retrieval_threshold.toFixed(2)}, a number I picked on 23 October from ten captured runs because real matches scored above 0.55 and near misses below 0.49. Ten runs is not a measurement. It is a guess that happened to split cleanly.`}
        found={`${passed(policy)} of ${policy.length}. Two of the misses are the same failure: the right section exists and scored 0.47 and 0.28, so the model was shown nothing and said the policies do not cover it. ${pct(s.retrieval.recall)} of the sections I expected were shown, and ${pct(s.retrieval.precision)} of the sections shown were ones I expected.`}
        decided="On the earlier 52-case set I ran the policy questions at five thresholds and repeated the middle three, because one run swung by two cases. At 0.40 every expected section was shown on every repeat, at the cost of showing more sections that did not apply. The two errors are not equal. An extra section is mostly ignored. A hidden one makes the model say there is no rule, and the owner has no way to see through that. So the threshold moves to 0.40 on the next run. The miss at 0.28 will not be fixed by any threshold. That one is the wording of the search, and it is still open."
      >
        <Failures results={policy.filter((r) => r.case.id !== "pol-11")} />
      </Experiment>

      <Experiment
        slug="citations"
        title="Does it cite only what it was shown?"
        question="An answer that cites a section the model was never shown is an answer made up. A code step compares every citation in the answer with the sections retrieved. I wanted to see it fire."
        ran="Every policy case runs through it. The grader recomputes the check from the answer text, so a regrade uses today's parser and not the one from the day of the run."
        found="It fired once, on an answer that was right. The model wrote [§5] without the document name and the step failed it. A formatting slip, caught by code, and counted against the model because that is what the check is for."
        decided="This is the check doing its job. What it does not do is read. It knows a cited section was shown, not that the section says what the answer claims. That is the third kind of wrong, the one with no code behind it, and I have not built it because I do not yet know how to check support without a second model whose own errors I would then have to measure."
      >
        <Failures results={policy.filter((r) => r.case.id === "pol-11")} />
      </Experiment>

      <Experiment
        slug="actions"
        title="Does code hold the line on actions?"
        question="When the model proposes an action, code re-derives every rule from the limits file and the database before a person sees it. I wanted to know whether anything that breaks a rule gets through."
        ran={`${propose.length} proposals: disputes inside and outside their window, campaigns over and under the discount cap, an audience the model counted wrong, a comp over the manager's limit. And ${guarded.length} questions that must be declined, scoped to the asking restaurant, or answered without a search.`}
        found={`${passed(propose)} of ${propose.length}, and ${passed(guarded)} of ${guarded.length}. The checker counted 563 customers with verified consent where the model said everyone with a phone number, 29,762 of them. It blocked a 25% campaign under a 20% cap and a dispute filed 26 days after a 7-day window.`}
        decided="This is the strongest part of the system, and the reason is structural, not clever: the model's proposal is an input, and the verdict comes from code reading the same rules a person would. It is the part worth extending. The cost is that every rule has to be written down as a limit a program can check, and the owners' policies are written for people."
      >
        <Failures results={[...propose, ...guarded]} />
      </Experiment>

      <Experiment
        slug="model"
        title="Would a bigger model help?"
        question="The agent runs on Sonnet 5.5 at medium effort. I wanted to know whether a bigger model would fix the misses, because that is the first thing anyone suggests."
        ran="On the earlier 52-case set, Sonnet at low effort and Opus 5.5 at medium, once each."
        found="Sonnet low passed one more case than medium. Opus passed two fewer at 2.4 times the cost, and failed the same ways: a retrieval miss, a defensible reading of net, and addressing the asker as the owner."
        decided="The model is not the bottleneck. What it is shown is. I have not rerun this on the current set, so it stays here as a conclusion from the old one, and I would not quote it as more than that until I do."
      />

      <EveryCase />

      <section className="mt-24">
        <h2 id="limitations" className="mb-6 scroll-mt-28 text-3xl">Limitations</h2>
        <div className="space-y-4 text-lg leading-relaxed text-muted-foreground">
          <p>
            The graders check less than a person would. The SQL grader looks for my figure among
            the numbers in the answer, so a right number reached by a wrong query passes, and an
            answer that states the right figure and the wrong one both passes too. I saw that
            happen on one case. The policy grader checks that the right section is cited and that
            a few phrases appear. It does not judge whether the explanation is sound.
          </p>
          <p>
            {s.cases} cases catch regressions. They do not pin down a rate, and one run of each
            setting is one sample, which I learned the hard way when a repeat swung by two cases.
            Ground truth is mine: a query I wrote for each SQL case, the section I named for each
            policy case, and the status the trace records for refusals and proposals. If I read a
            word wrong, the gold is wrong, and the eval will not tell me.
          </p>
          <p>
            Every case runs through the same code path as the site, with the same prompt, tools
            and settings, on a frozen copy of the data with the clock set to{" "}
            {s.frozen_now.slice(0, 10)}. A request that errors is counted apart from the
            model&apos;s failures. The run file with every trace is in the repository under
            api/evals/runs.
          </p>
        </div>
      </section>
    </>
  );
}

// The runs, oldest first, in the form of a changelog: what changed before
// each one, what the score did, and what I concluded.
function Runs() {
  const latest = changelog[changelog.length - 1];

  return (
    <section className="mt-24">
      <h2 id="runs" className="mb-8 scroll-mt-28 text-3xl">The runs</h2>
      <ol className="border-l">
        {changelog.map((e, i) => (
          <li key={e.run} className="relative pb-12 pl-8 last:pb-0">
            <span className="absolute top-2 -left-[5px] size-[9px] rounded-full bg-primary" aria-hidden />
            <p className="font-sql text-xs text-muted-foreground">
              Run {i + 1}, {longDate(e.date)}
              {e === latest && <span className="ml-2 text-primary">this page</span>}
            </p>
            <h3 className="mt-2 text-2xl">{e.title}</h3>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-lg leading-relaxed text-muted-foreground">
              {e.changed.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
            <p className="mt-4 text-lg leading-relaxed">
              <strong>Result.</strong>{" "}
              {e === latest && `${data.summary.passed} of ${data.summary.scored}, ${dollars(data.summary.cost_total_usd)} for the run. `}
              {e.conclusion}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Experiment({
  slug,
  title,
  question,
  ran,
  found,
  decided,
  children,
}: {
  slug: string;
  title: string;
  question: string;
  ran: string;
  found: string;
  decided: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="mt-24">
      <h2 id={slug} className="mb-8 scroll-mt-28 text-3xl">{title}</h2>
      <dl className="grid gap-x-10 gap-y-6 text-lg leading-relaxed md:grid-cols-[10rem_1fr]">
        <Beat term="The question">{question}</Beat>
        <Beat term="What I ran">{ran}</Beat>
        <Beat term="What came back">{found}</Beat>
        <Beat term="What I decided">{decided}</Beat>
      </dl>
      {children}
    </section>
  );
}

function Beat({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="font-heading text-base text-primary md:pt-1">{term}</dt>
      <dd className="text-foreground">{children}</dd>
    </>
  );
}

function Failures({ results }: { results: Result[] }) {
  const cards = failed(results);

  if (cards.length === 0) return null;

  return (
    <div className="mt-12 space-y-12">
      {cards.map((r) => (
        <FailureCard
          key={r.case.id}
          id={r.case.id}
          headline={headline[r.case.id]}
          suite={suiteTitle[r.case.suite] ?? r.case.suite}
          tags={r.case.tags ?? []}
          merchantId={r.case.merchant_id}
          question={r.case.question}
          expected={describeExpectation(r.case)}
          reasons={r.grade.reasons}
          diagnosis={diagnosis[r.case.id]}
          goldSql={r.case.gold_sql}
          modelSql={modelQuery(r.trace)}
          trace={r.trace}
        />
      ))}
    </div>
  );
}

function SqlTable({ results }: { results: Result[] }) {
  return (
    <Table className="mt-10 min-w-[720px]">
      <TableHeader>
        <TableRow>
          <TableHead>Case</TableHead>
          <TableHead>Question</TableHead>
          <TableHead className="text-right">Expected</TableHead>
          <TableHead className="text-right">Answered</TableHead>
          <TableHead>Result</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {results.map((r) => (
          <TableRow key={r.case.id}>
            <TableCell className="font-sql text-xs">
              <Link href={`/evaluation/${r.case.id}`} className="text-primary underline-offset-4 hover:underline">
                {r.case.id}
              </Link>
            </TableCell>
            <TableCell className="whitespace-normal">{r.case.question}</TableCell>
            <TableCell className="text-right font-sql text-[13px] whitespace-nowrap">{figure(r.grade.expected, r.case.value_kind)}</TableCell>
            <TableCell className="text-right font-sql text-[13px] whitespace-nowrap">{r.grade.found === null ? "–" : figure(r.grade.found, r.case.value_kind)}</TableCell>
            <TableCell>
              <OutcomeBadge outcome={r.grade.outcome} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function EveryCase() {
  return (
    <section className="mt-24">
      <h2 id="every-case" className="mb-6 scroll-mt-28 text-3xl">Every case</h2>
      <Table className="min-w-[760px]">
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

function passed(results: Result[]): number {
  return results.filter((r) => r.grade.outcome === "pass").length;
}

function pct(v: number | null): string {
  return v === null ? "n/a" : `${Math.round(v * 100)}%`;
}

function figure(v: unknown, kind: string | undefined): string {
  if (typeof v !== "number") return String(v ?? "–");

  if (kind === "cents") return v.toLocaleString("en-US", { style: "currency", currency: "USD" });

  if (kind === "pct") return `${v}%`;

  return count(v);
}

function longDate(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}
