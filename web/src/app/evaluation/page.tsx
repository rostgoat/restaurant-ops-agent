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
  `Results from testing the agent on ${data.summary.cases} restaurant questions, including failures, changes between runs, and model costs.`,
  "/evaluation",
);

const outline = [
  { slug: "summary", title: "Summary" },
  { slug: "runs", title: "Run history" },
  { slug: "meaning", title: "Does the agent understand the question?" },
  { slug: "retrieval", title: "Does the agent find the right rule?" },
  { slug: "citations", title: "Do citations match the retrieved policies?" },
  { slug: "actions", title: "Does the action checker enforce the rules?" },
  { slug: "every-case", title: "All test results" },
  { slug: "conclusion", title: "Findings and limitations" },
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
          Testing the agent with {s.cases} restaurant questions
        </h1>
        <p className="mt-8 text-xl leading-relaxed text-muted-foreground">
          I repeat the tests after changing the agent or the grader to see what improves and
          what breaks. Here are the results from each run.
        </p>
      </section>

      <section id="summary" className="mt-16 scroll-mt-28">
        <h2 className="mb-6 text-3xl">Summary</h2>
        <div className="max-w-[70ch] space-y-4 text-lg leading-relaxed">
          <p>
            I tested the agent with {s.cases} questions a restaurant owner might ask. Before
            running the tests, I worked out the expected results: sales figures from queries I
            wrote myself, relevant policy sections, and whether the agent should propose an
            action or refuse it.
          </p>
          <p>
            The first run passed 34 of the original 38 tests. Between runs, I changed the prompts,
            search settings, or grading rules, then repeated the tests to check whether the
            change helped or caused other failures. By the eighth run, Sonnet 5.5 passed all {s.cases},
            and a closing tenth run on Sonnet passed all {s.cases} again.
          </p>
          <p>
            I then tested Haiku 5.5 on the same questions. It passed 38 of {s.cases} at about
            one-twelfth the cost. The results below show what failed, what I changed, and how
            the two models compared.
          </p>
        </div>
      </section>

      <Runs />

      <Experiment
        number={1}
        slug="meaning"
        title="Does the agent understand the question?"
        question="The SQL safety checks prevent unsafe queries, but they do not check whether a query answers the owner’s question. I tested whether the agent used the right definitions, dates, and calculations."
        ran="I started with ten questions using terms such as 'lunch', 'regular', 'summer', 'lift', and 'net payout', whose definitions depend on the restaurant. I wrote a reference query for each question and ran it on the fixed test database. The agent does not see these queries. The grader checks whether any number in its answer matches the expected result within the test’s tolerance. I later added an eleventh question about catering orders."
        found="The first two runs passed 9 of 10 tests. Both failed after a query timed out and the retry converted time zones incorrectly. September’s boundaries were ten hours early, producing $2.49 instead of $2.64. After I added date conversion instructions, run 3 passed all ten tests. Run 4 also passed after a timeout and retry. The later catering question exposed another error: the agent searched order labels instead of menu categories and said the data could not answer the question. After I added instructions to check the menu and corrected the test dates, that case passed too."
        decided="Keep the reference queries available beside the agent’s queries so readers can compare them. Prompt instructions helped with the errors I found, but the system still allows safe queries that answer the wrong question. A check comparing the query’s date range with the dates in the question remains a possible improvement."
      >
        <Failures results={sql} />
      </Experiment>

      <Experiment
        number={2}
        slug="retrieval"
        title="Does the agent find the right rule?"
        question="Policy answers depend on search returning the relevant sections. I tested how often the similarity threshold excluded a rule the agent needed and whether keyword matching could recover it."
        ran={`${policy.length} policy questions, with the expected citations recorded for each question the policies cover. The first run used a similarity threshold of 0.50, chosen from ten earlier runs where relevant sections scored above 0.55 and related but unhelpful sections below 0.49. Run 2 lowered the threshold to 0.40. Run 6 added keyword matching, weighted by how rare each word is in the restaurant’s policies. Search now combines both rankings and includes the best keyword match even below the similarity threshold.`}
        found={`The first two runs each passed 11 of ${policy.length} policy tests under the grader used at the time. Lowering the threshold retrieved one previously missed rule, but also returned Allergies for a health inspection question. The agent correctly explained that the section did not apply; the grader rejected that answer until I corrected its rules. Retrieval recall rose from 86% to 93%, while precision fell from 46% to 29%. The other missed rule appeared in run 4 after different search wording, then disappeared again in run 5. Keyword matching returned it in run 6 for the word DoorDash, despite a similarity score of 0.34. Recall reached 100% and precision was 28%. Across 38 searches, five sections appeared through keyword matching alone: the needed rule and four copies of the House Policy introduction, which the agent ignored.`}
        decided="Keep the 0.40 threshold and keyword matching. In these tests, irrelevant sections were usually ignored, while missing sections led to incorrect advice that the policies contained no rule. Lowering the threshold further would have returned 19 unwanted sections in run 5 to recover the remaining rule. Keyword matching retrieved that rule directly. It adds a database column and one lookup per search; the trace records which method returned each section."
      >
        <Failures results={policy.filter((r) => !CITATION_CASES.includes(r.case.id))} />
      </Experiment>

      <Experiment
        number={3}
        slug="citations"
        title="Do citations match the retrieved policies?"
        question="The citation check compares each citation label with the policy sections returned by search. I tested whether it rejected citations that did not match a retrieved label."
        ran="Every policy test runs the citation check. When I regrade saved answers, the grader uses the current citation parser, so the result can differ from the original run."
        found="The check rejected four correct answers across the first three runs because the agent shortened citation labels. Examples included [§5], [§4, Frequency], and a document name without its section title. The campaign case failed in all three runs; the quiet hours case failed in run 2. Before run 4, I added two sentences requiring full labels every time. That run contained no shortened labels, and both cases passed."
        decided="Keep exact label matching and require the agent to write full labels. Accepting shortened labels would require rules for resolving them to a retrieved section. The prompt change was enough for these tests. This check still does not establish that a cited section supports the answer; it only confirms that search returned the section."
      >
        <Failures results={policy.filter((r) => CITATION_CASES.includes(r.case.id))} />
      </Experiment>

      <Experiment
        number={4}
        slug="actions"
        title="Does the action checker enforce the rules?"
        question="Before a proposal reaches a person, the action checker reads the limits file and database to verify it. I tested whether it blocked proposals that broke the rules."
        ran={`${propose.length} action tests covering dispute deadlines, discount caps, customer audience counts, and a comp above the manager’s limit. Another ${guarded.length} tests check that the agent declines prohibited requests, limits queries to the asking restaurant’s data, and answers simple questions without a policy search.`}
        found={`The latest run, using Haiku, passed ${passed(propose)} of ${propose.length} action tests and ${passed(guarded)} of ${guarded.length} other checks. Earlier Sonnet runs passed all eight action tests. The checker counted 563 customers with verified consent where the agent had counted 29,762 with phone numbers. It also blocked a 25% discount above a 20% cap and a dispute submitted 26 days after the order, outside the 7-day window. Haiku failed one test by asking for a packing photo instead of submitting a dispute proposal, so the checker received nothing to evaluate.`}
        decided="Extend the action checker where rules can be expressed in code. It verifies proposals against the database rather than relying on the agent’s counts or interpretation. Each rule still needs an explicit, programmable limit, and the checker cannot evaluate an action the agent never proposes."
      >
        <Failures results={[...propose, ...guarded]} />
      </Experiment>

      <section className="mt-24">
        <h2 id="every-case" className="mb-6 scroll-mt-28 text-3xl">All test results</h2>
        <EveryCase cases={data.results.map((r) => r.case)} runs={runs} />
        {errors.length > 0 && (
          <p className="mt-8 text-sm text-muted-foreground">
            {errors.length} {errors.length === 1 ? "case" : "cases"} ended in an error from the API
            or the test runner and {errors.length === 1 ? "is" : "are"} excluded from the pass rate: {errors.map((r) => r.case.id).join(", ")}.
          </p>
        )}
      </section>

      <section className="mt-24">
        <h2 id="conclusion" className="mb-6 scroll-mt-28 text-3xl">Findings and limitations</h2>
        <div className="space-y-4 text-lg leading-relaxed text-muted-foreground">
          <p>
            Ten runs tested whether the agent could follow action rules, calculate the right
            figures, and use policy citations correctly. The results show where the checks
            helped and where they are still incomplete.
          </p>
          <ol className="list-decimal space-y-3 pl-6">
            <li>
              <strong className="text-foreground">Checking action proposals.</strong> The action
              checker blocked a 25% discount above a 20% cap and a dispute outside the 7-day
              window. It also corrected an audience count from 29,762 customers with phone
              numbers to 563 with verified consent. Sonnet passed all eight action tests in
              every run. Haiku did not propose one dispute, so the checker could not evaluate it.
            </li>
            <li>
              <strong className="text-foreground">Checking what a query means.</strong> Two
              errors passed the SQL safety checks: a date range shifted by ten hours and a
              catering search in the wrong fields. Prompt changes helped address both, but the
              system still cannot detect these mistakes during normal use. The tests compare
              answers against my reference queries for the 11 SQL questions.
            </li>
            <li>
              <strong className="text-foreground">Checking whether a citation supports an
              answer.</strong> The citation check confirms that the agent saw a section, but
              does not check its interpretation. I tried 34 additional questions designed to
              produce an unsupported citation and found none. Haiku also produced none in the
              15 policy tests. I then tried a code check requiring every number in a sentence
              with a citation to appear in the cited section. Across 578 sentences from nine
              runs, it flagged 53 correct answers, including comparisons of a $40 comp with a
              $25 policy limit. The check could not distinguish the requested amount from the
              policy limit, so I removed it.
            </li>
          </ol>
          <p>
            <strong className="text-foreground">What the scores tell us.</strong> Sonnet passed
            all 39 tests in run 8. That shows it could answer this set of questions after the
            changes; it does not establish how it will handle new questions. Along the way,
            prompt changes helped with two query errors, and keyword matching fixed a recurring
            search failure. I also corrected one grading rule and three phrase lists that had
            rejected valid answers. A full Sonnet run cost about $0.50. The table above shows
            how each test result changed between runs.
          </p>
          <p>
            <strong className="text-foreground">What the graders miss.</strong> The SQL grader
            accepts an answer if it contains the expected number, even if that number came from
            the wrong calculation. The policy grader checks citation labels and accepted
            phrases, which can reject valid wording. I wrote the expected answers myself, so a
            mistake in my interpretation can also become a mistake in the test. Every test uses
            the same agent code as the site, a fixed copy of the data, and a clock set to{" "}
            {s.frozen_now.slice(0, 10)}. The saved traces are in api/evals/runs.
          </p>
        </div>
      </section>
    </>
  );
}

// Run history, oldest first, in the form of a changelog: what changed before
// each one, what the score did, and what I concluded.
function Runs() {
  return (
    <section id="runs" className="mt-16 scroll-mt-28">
      <h2 className="mb-8 text-3xl">Run history</h2>
      <ol className="border-l">
        {changelog.map((e, i) => (
          <li key={e.run ?? i} className="relative pb-12 pl-8 last:pb-0">
            <span className="absolute top-2 -left-[5px] size-[9px] rounded-full bg-primary" aria-hidden />
            <p className="font-sql text-xs text-muted-foreground">{longDate(e.date)}</p>
            <h3 className="mt-2 text-2xl">
              {e.run ? `Run ${runs.findIndex((r) => r.run === e.run) + 1}: ` : ""}
              {e.title}
            </h3>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-lg leading-relaxed text-muted-foreground">
              {e.changed.map((c) => (
                <li key={c}>
                  <Inline text={c} />
                </li>
              ))}
            </ul>
            <p className="mt-4 text-lg leading-relaxed">
              <strong>Result:</strong> {e.result}
              {regraded(e) !== null && ` After regrading: ${regraded(e)} of 38.`}
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-lg leading-relaxed">
              {e.moved.map((m) => (
                <li key={m}>
                  <Inline text={m} />
                </li>
              ))}
            </ul>
            <p className="mt-4 text-lg leading-relaxed">
              <strong>Next step:</strong> {e.next}
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
        <Beat term="What I checked">{question}</Beat>
        <Beat term="How I tested it">{ran}</Beat>
        <Beat term="Results">{found}</Beat>
        <Beat term="Decision">{decided}</Beat>
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
