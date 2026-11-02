import Markdown from "react-markdown";
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
  type Entry,
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
  { slug: "conclusion", title: "Conclusion" },
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
        <p className="mt-6 max-w-[70ch] text-lg leading-relaxed">
          I wrote {s.cases} questions a restaurant owner would ask, each with the answer worked
          out by hand before the agent saw it: a figure from a query I wrote, a policy section
          it should cite, or an action it should propose or refuse. The first run passed 34.
          Each run after that changed one thing, a prompt line, a threshold, a grader rule, the
          search itself, and re-ran all {s.cases} to see what that one change moved. Eight runs
          later it passes {s.cases}, and every failure along the way has a name and a cost on
          this page.
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
        ran={`${policy.length} policy questions, each with the section I expect it to cite. The first run used a threshold of 0.50, a number I picked from ten captured runs because real matches scored above 0.55 and near misses below 0.49. The second run changed that one number to 0.40 and nothing else. The sixth run changed the search itself: every section is also scored by how many of the search's words it contains, weighted by how rare each word is in this restaurant's policies, the two rankings are merged by rank, and the best word match is shown even under the threshold.`}
        found={`11 of ${policy.length} on both threshold runs as graded that day, and the same score hides a trade. At 0.50 two misses were the same failure: the right section scored 0.47 and 0.28, the agent was shown nothing, and it said the policies do not cover it. At 0.40 the 0.47 case passes. In its place, a question the policies really do not cover (health inspections) pulls in the Allergies section at 0.41, and the agent cites it to say it does not apply, which the grader counted as a fail. Recall went from 86% to 93%. Precision went from 46% to 29%. The third run changed the prompt, not the threshold, and the retrieval picture stayed where it was. In the fourth run the 0.28 section came through at 0.51, because the agent happened to word its search differently. In the fifth it scored 0.36 on a third wording and was hidden again. In the sixth, with the word search, it was shown on the first search for the word DoorDash, at a meaning score of 0.34, and cited. Recall 100%. Precision 28%: five sections shown for their words alone across 38 searches, one of them the one that mattered, four of them the same scope preamble, set aside each time.`}
        decided="The two errors are not equal. An extra section shown is mostly ignored, and when the agent did lean on one it said that it did not apply. A hidden section makes the agent say there is no rule, and the owner has no way to see through that. So 0.40 stays. It rescued one rule and cost 17 points of precision. It also cost one grade, until I changed the grader in run 5. The miss at 0.28 was never about the threshold. Six single-case reps of prompt wording put the agent's searches at 0.37 to 0.39 against a 0.40 line, and a lower line would have shown 19 unwanted sections in run 5 to rescue it. It was about the word DoorDash, which is in the section and which an embedding does not see. So the search now matches words too, and the trace says which score showed each section. The cost is one more lookup per search, a column in the policy table, and one extra section on about one search in eight, so far always the same preamble."
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
        decided="This is the check doing its job, and it is also the check being literal. A reader knows which document [§4, Frequency] means when only one document was shown. I could have let the step accept a short label when it matches exactly one retrieved section, or tell the agent to write the full label every time. I chose the second, because the check is the part I trust and I would rather not teach it to guess, and two runs say it held. What the step still does not do is read: it knows a cited section was shown, not that the section supports the answer. That is the third kind of wrong, and it has no code behind it yet."
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
        <h2 id="conclusion" className="mb-6 scroll-mt-28 text-3xl">Conclusion</h2>
        <div className="space-y-4 text-lg leading-relaxed text-muted-foreground">
          <p>
            <strong className="text-foreground">What six runs showed.</strong> Every failure the
            first run found was one of three things.
          </p>
          <ol className="list-decimal space-y-2 pl-6">
            <li>
              A slip the agent can be told not to make. The date boundary and the citation label,
              one prompt line each, and neither has come back in the runs since.
            </li>
            <li>
              A rule of mine that was wrong. The not-covered case, and two phrase lists that did
              not have the words the agent used.
            </li>
            <li>
              A limit of the design. The hidden section that no threshold and no wording could
              reach, which needed a search that sees words as well as meaning. That one was the
              only failure about the system rather than the prompt or the test, and it took a new
              mechanism, not a line.
            </li>
          </ol>
          <p>
            <strong className="text-foreground">What the score means.</strong> 38 of 38 on the
            sixth run is not evidence the agent works. It is evidence that these 38 questions,
            which I wrote, no longer catch it. Three of the fixes were patches for a slip I had
            seen, and the page says so where each one lives. What the runs do show is that one
            change at a time can be measured on this set for about fifty cents, and that the
            matrix tells you which change moved which case.
          </p>
          <p>
            <strong className="text-foreground">What is caught, measured, and neither.</strong>{" "}
            An action that breaks a rule is caught by code before anyone sees it, eight of eight,
            every run. A safe query that answers the wrong question is measured against my query
            and not caught, and the one case of it was fixed by telling the agent how to write a
            date. A cited section that does not support the answer is still neither: the
            citations step knows a section was shown, not that it says what the answer claims.
            That is the gap I have not built, because I do not yet know how to check support
            without a second model whose own errors I would then have to measure.
          </p>
          <p>
            <strong className="text-foreground">What the graders cannot see.</strong> The SQL
            grader looks for my figure among the numbers in the answer, so a right number from a
            wrong query passes. The policy grader checks the section cited and a list of phrases,
            and twice the list was short. Ground truth is mine throughout. If I read a word wrong,
            the gold is wrong, and the eval will not tell me. Every case runs through the same
            code as the site, on a frozen copy of the data with the clock set to{" "}
            {s.frozen_now.slice(0, 10)}, and every trace is in the repository under
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
  return (
    <section className="mt-24">
      <h2 id="runs" className="mb-8 scroll-mt-28 text-3xl">The runs</h2>
      <ol className="border-l">
        {changelog.map((e, i) => (
          <li key={e.run ?? i} className="relative pb-12 pl-8 last:pb-0">
            <span className="absolute top-2 -left-[5px] size-[9px] rounded-full bg-primary" aria-hidden />
            <p className="font-sql text-xs text-muted-foreground">
              {e.run ? `Run ${runs.findIndex((r) => r.run === e.run) + 1}` : "Regrade"}, {longDate(e.date)}
            </p>
            <h3 className="mt-2 text-2xl">{e.title}</h3>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-lg leading-relaxed text-muted-foreground">
              {e.changed.map((c) => (
                <li key={c}>
                  <Inline text={c} />
                </li>
              ))}
            </ul>
            <p className="mt-4 text-lg leading-relaxed">
              <strong>Result.</strong> {e.result}
              {regraded(e) !== null && ` Graded again later: ${regraded(e)} of 38.`}
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-lg leading-relaxed">
              {e.moved.map((m) => (
                <li key={m}>
                  <Inline text={m} />
                </li>
              ))}
            </ul>
            <p className="mt-4 text-lg leading-relaxed">
              <strong>Next.</strong> {e.next}
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

// One changelog line, with a markdown link allowed and no paragraph wrapper.
function Inline({ text }: { text: string }) {
  return (
    <Markdown
      components={{
        p: ({ children }) => <>{children}</>,
        a: ({ href, children }) => {
          const external = href?.startsWith("http");

          return (
            <a
              href={href}
              target={external ? "_blank" : undefined}
              rel={external ? "noreferrer" : undefined}
              className={external ? "text-primary underline-offset-4 hover:underline" : "font-sql text-base text-primary underline-offset-4 hover:underline"}
            >
              {children}
            </a>
          );
        },
      }}
    >
      {text}
    </Markdown>
  );
}

// The score a run has under today's grader, when it differs from the day's.
function regraded(e: Entry): number | null {
  const now = runs.find((r) => r.run === e.run)?.passed;

  if (now === undefined || e.passed === null || now === e.passed) return null;

  return now;
}

function longDate(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}
