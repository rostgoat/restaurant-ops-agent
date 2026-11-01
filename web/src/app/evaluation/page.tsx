import { Kicker } from "@/components/kicker";
import { pageMetadata } from "@/lib/site";
import { EveryCase } from "@/components/every-case";
import { CaseFailure } from "@/components/failure-card";
import { PageOutline } from "@/components/page-outline";
import {
  changelog,
  data,
  errors,
  failed,
  runs,
  suite,
  type Result,
} from "@/lib/evaluation";

// Policy cases whose only failure was the citation label, shown under experiment 3.
const CITATION_CASES = ["pol-03", "pol-11"];

export const metadata = pageMetadata(
  "Evaluation",
  `The same ${data.summary.cases} questions, re-run each time I change one variable. Each run says what moved, what it cost, and what I decided.`,
  "/evaluation",
);

const outline = [
  { slug: "runs", title: "The runs" },
  { slug: "meaning", title: "Does the agent interpret the question how an owner would?" },
  { slug: "retrieval", title: "Does the agent find the right rule?" },
  { slug: "citations", title: "Does the agent cite only what it was shown?" },
  { slug: "actions", title: "Does code hold the line on actions?" },
  { slug: "every-case", title: "Every case" },
  { slug: "limitations", title: "Limitations" },
];

export default function EvaluationPage() {
  const s = data.summary;
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
          The experiment. The same {s.cases} questions, re-run each time I change one variable.
        </h1>
        <p className="mt-8 text-xl leading-relaxed text-muted-foreground">
          Every run attempts to fix at least one failing case while observing whether the
          remaining cases succeed or fail.
        </p>
      </section>

      <Runs />

      <Experiment
        number={1}
        slug="meaning"
        title="Does the agent interpret the question how an owner would?"
        question="A query can pass all eight safety checks and still answer a different question from the one the owner asked. I wanted to know how often that happens, because nothing in the system would tell me."
        ran="Ten questions where specific words carry a unique definition for each owner: 'lunch', 'regular', 'summer', 'lift', 'net payout'. For each one I wrote the query, ran it against a frozen database, and kept the figure. The model never sees the query. The grader reads every number in the model's answer and passes the case if one of them is within the case's tolerance of mine."
        found="9 of 10 on the first two runs, the same miss both times: a query that converted time zones in the wrong direction on a retry after a timeout, so September started ten hours early and ended ten hours early. It passed the guard, ran clean, and came back $2.49 against my $2.64. For the third run I added five lines to the prompt saying how to write a local-time boundary, and it came back 10 of 10 with the first query clean. The fourth run hit the timeout and retry again, and the retry kept the right window."
        decided="Nothing catches this at runtime, and nothing in the guard could, because the query is safe. So I measure it instead of pretending to enforce it, and I put my query beside the model's on every case so a reader can see where the two read a word differently. The prompt line fixed the one mistake I had seen. It is a patch, not a catch: a wrong window written some other way would still pass. The check that would catch it, code comparing a query's date window with the dates in the question, is still on the list."
      >
        <Failures results={sql} />
      </Experiment>

      <Experiment
        number={2}
        slug="retrieval"
        title="Does the agent find the right rule?"
        question="When an owner asks what is allowed, the agent searches their policies and only sees the sections that score above a similarity threshold. If the right section scores under that line, the agent is told nothing matched and answers as if there is no rule. I wanted to know how often that happens."
        ran={`${policy.length} policy questions, each with the section I expect it to cite. The first run used a threshold of 0.50, a number I picked from ten captured runs because real matches scored above 0.55 and near misses below 0.49. The second run changed that one number to ${s.retrieval_threshold.toFixed(2)} and nothing else.`}
        found={`11 of ${policy.length} on both threshold runs, and the same score hides a trade. At 0.50 two misses were the same failure: the right section scored 0.47 and 0.28, the agent was shown nothing, and it said the policies do not cover it. At 0.40 the 0.47 case passes. In its place, a question the policies really do not cover (health inspections) pulls in the Allergies section at 0.41, and the agent cites it to say it does not apply, which the grader counts as a fail. Recall went from 86% to 93%. Precision went from 46% to 29%. The third run changed the prompt, not the threshold, and the retrieval picture stayed where it was. In the fourth run the 0.28 section came through at 0.51, because the agent happened to word its search differently, and recall reached ${pct(s.retrieval.recall)}.`}
        decided="The two errors are not equal. An extra section shown is mostly ignored, and when the agent did lean on one it said that it did not apply. A hidden section makes the agent say there is no rule, and the owner has no way to see through that. So 0.40 stays. It rescued one rule, cost 17 points of precision and one grade, and showed that my rule for a not-covered case (nothing shown, nothing cited) is stricter than the behaviour I want. The miss at 0.28 passed once, on a run that changed nothing about retrieval, because the agent worded the search better that time. No threshold reaches it on the other wordings. That case is about the wording of the search, one pass does not close it, and the grader rule is the next change."
      >
        <Failures results={policy.filter((r) => !CITATION_CASES.includes(r.case.id))} />
      </Experiment>

      <Experiment
        number={3}
        slug="citations"
        title="Does the agent cite only what it was shown?"
        question="An answer that cites a section the agent was never shown is an answer made up. A code step compares every citation in the answer with the sections retrieved. I wanted to see it fire."
        ran="Every policy case runs through it. The grader recomputes the check from the answer text, so a regrade uses today's parser and not the one from the day of the run."
        found="It fired on four answers across the first three runs, every one of them right. The agent cited the first section with its full label, then shortened a later one: [§5], [§4, Frequency], or the document name without the section title. The step failed each. The campaign case failed all three runs, each time on a different shortening, and the quiet hours case failed only in run 2. For the fourth run I added two sentences to the prompt: write the whole label every time, never shorten it. No short label anywhere in that run, and both cases passed."
        decided="This is the check doing its job, and it is also the check being literal. A reader knows which document [§4, Frequency] means when only one document was shown. I could have let the step accept a short label when it matches exactly one retrieved section, or tell the agent to write the full label every time. I chose the second, because the check is the part I trust and I would rather not teach it to guess, and one run says it held. What the step still does not do is read: it knows a cited section was shown, not that the section supports the answer. That is the third kind of wrong, and it has no code behind it yet."
      >
        <Failures results={policy.filter((r) => CITATION_CASES.includes(r.case.id))} />
      </Experiment>

      <Experiment
        number={4}
        slug="actions"
        title="Does code hold the line on actions?"
        question="When the agent proposes an action, code re-derives every rule from the limits file and the database before a person sees it. I wanted to know whether anything that breaks a rule gets through."
        ran={`${propose.length} proposals: disputes inside and outside their window, campaigns over and under the discount cap, an audience the agent counted wrong, a comp over the manager's limit. And ${guarded.length} questions that must be declined, scoped to the asking restaurant, or answered without a search.`}
        found={`${passed(propose)} of ${propose.length}, and ${passed(guarded)} of ${guarded.length}. The checker counted 563 customers with verified consent where the agent said everyone with a phone number, 29,762 of them. It blocked a 25% campaign under a 20% cap and a dispute filed 26 days after a 7-day window.`}
        decided="This is the strongest part of the system, and the reason is structural: the agent's proposal is an input, and the verdict comes from code reading the same rules a person would. It is the part worth extending. The cost is that every rule has to be written down as a limit a program can check, and the owners' policies are written for people."
      >
        <Failures results={[...propose, ...guarded]} />
      </Experiment>

      <section className="mt-24">
        <h2 id="every-case" className="mb-6 scroll-mt-28 text-3xl">Every case</h2>
        <EveryCase cases={data.results.map((r) => r.case)} runs={runs} />
        {errors.length > 0 && (
          <p className="mt-8 text-sm text-muted-foreground">
            {errors.length} {errors.length === 1 ? "case" : "cases"} ended in an error from the API
            or the harness and {errors.length === 1 ? "is" : "are"} left out of the pass rate rather
            than counted against the model: {errors.map((r) => r.case.id).join(", ")}.
          </p>
        )}
      </section>

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
            {s.cases} cases catch regressions. They do not pin down a rate, and one run of a
            setting is one sample: the model words its own searches differently each time, so the
            same case can pass today and fail tomorrow. Ground truth is mine: a query I wrote for each SQL case, the section I named for each
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
              <strong>Result.</strong> {e.result} {e.conclusion}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Experiment({
  number,
  slug,
  title,
  question,
  ran,
  found,
  decided,
  children,
}: {
  number: number;
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
      <p className="font-sql text-xs text-muted-foreground">Experiment {number} of 4</p>
      <h2 id={slug} className="mt-2 mb-8 scroll-mt-28 text-3xl">{title}</h2>
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
        <CaseFailure key={r.case.id} result={r} />
      ))}
    </div>
  );
}

function passed(results: Result[]): number {
  return results.filter((r) => r.grade.outcome === "pass").length;
}

function pct(v: number | null): string {
  return v === null ? "n/a" : `${Math.round(v * 100)}%`;
}

function longDate(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}
