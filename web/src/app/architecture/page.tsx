import { ArchitectureDiagram } from "@/components/architecture-diagram";
import { Kicker } from "@/components/kicker";
import { PageOutline } from "@/components/page-outline";
import { Separator } from "@/components/ui/separator";
import { data } from "@/lib/evaluation";

export const metadata = { title: "Architecture" };

const REPO = "https://github.com/rostgoat/restaurant-ops-agent/blob/main/";

const sections = [
  { slug: "tools", title: "The model picks a tool" },
  { slug: "guard", title: "The guard" },
  { slug: "database", title: "The database" },
  { slug: "retrieval", title: "Policy retrieval" },
  { slug: "proposals", title: "Proposals and the checker" },
  { slug: "citations", title: "The citation check" },
  { slug: "approval", title: "The approval step" },
  { slug: "trace", title: "The trace and the cost" },
  { slug: "decisions", title: "Decisions" },
  { slug: "gaps", title: "What it does not do" },
];

function File({ path }: { path: string }) {
  return (
    <a href={REPO + path} className="font-sql text-sm text-primary underline-offset-4 hover:underline">
      {path.split("/").pop()}
    </a>
  );
}

export default function ArchitecturePage() {
  const s = data.summary;
  return (
    <>
      <PageOutline items={sections} />
      <article className="text-lg leading-relaxed">
        <Kicker page="Architecture" />
        <h1 className="mt-4 mb-10 text-5xl">How a question becomes an answer</h1>
        <p>
          Every request goes through the same steps. The model decides what to try. Code decides
          what runs. A person decides what happens. The trace records all three, so a wrong answer
          from the model stays a wrong answer and never becomes a wrong action.
        </p>

        <ul className="mt-8 list-disc space-y-2 pl-6">
          <li>The model writes SQL, searches the policies and drafts actions. It never executes anything.</li>
          <li>Code takes every query apart before it runs: no writes, one restaurant&apos;s rows only, read-only.</li>
          <li>
            Policy search is limited to one restaurant and to sections above a score threshold.
            Citations are checked.
          </li>
          <li>An action waits for a person. Approval produces a simulated record, not a real send.</li>
          <li>Every step is recorded with who did it, what it cost and how long it took.</li>
        </ul>

        <figure className="my-14">
          <ArchitectureDiagram />
          <figcaption className="mt-4 text-base text-muted-foreground">
            The request path. Each box is a step the trace records, in the colour the trace uses.
          </figcaption>
        </figure>

        <Separator className="my-14" />
        <h2 id="tools" className="mb-3 scroll-mt-28 text-2xl">
          The model picks a tool
        </h2>
        <p>
          The model gets the question and a description of the seven tables it may read. It has
          four tools. run_sql writes one SELECT and says what it answers. search_policy asks for
          the rules on a topic. propose drafts an action: a dispute, a text campaign, a comp or a
          note to the owner. decline turns the question down and says why. The model can call up
          to six tools in one request, in any order, or answer in plain text with none. I gave it
          no tool that changes anything, so there is nothing for a bad prompt to reach.{" "}
          <File path="api/app/agent/tools.py" />
        </p>

        <Separator className="my-14" />
        <h2 id="guard" className="mb-3 scroll-mt-28 text-2xl">
          The guard
        </h2>
        <p>
          The guard takes the SQL apart with sqlglot into the parts the database would see, a
          parse tree, instead of reading it as text. A string match misses a write hidden behind a
          comment or odd casing. The parsed query does not. It runs eight
          checks: the query parses, it is one statement, it is a SELECT, it contains no write, it
          calls no function that reads files or reaches the network, it reads only the seven
          allowed tables, it is scoped to one restaurant, and it fits under a row limit. The scope
          check adds the filter rather than looking for one. Every table in the query is replaced
          by that restaurant&apos;s rows, so a join or a subquery cannot reach another restaurant.
          A blocked query goes back to the model with the name of the check that failed, and the
          model can try again. If nothing runs, the trace ends as blocked.{" "}
          <File path="api/app/sql/guard.py" />
        </p>

        <Separator className="my-14" />
        <h2 id="database" className="mb-3 scroll-mt-28 text-2xl">
          The database
        </h2>
        <p>
          The query runs in a read-only transaction with a five-second statement timeout. If a
          write got past the guard, the database refuses it. If a query is slow, the database
          stops it. The model gets at most a hundred rows, and the trace keeps exactly the rows it
          got, so a wrong figure can be checked against what the model saw.{" "}
          <File path="api/app/sql/execute.py" />
        </p>

        <Separator className="my-14" />
        <h2 id="retrieval" className="mb-3 scroll-mt-28 text-2xl">
          Policy retrieval
        </h2>
        <p>
          Each restaurant has three policy documents written as a manual, with numbered sections.
          Each section is stored with an embedding in Postgres, using pgvector. A search is
          limited to the asking restaurant before any score is computed, the same way the guard
          limits a query. Up to four sections come back, and only those scoring above{" "}
          {s.retrieval_threshold.toFixed(2)}. Sections under the bar are written to the trace but
          not shown to the model. When nothing clears the bar, the model is told so. I chose a
          threshold over a fixed top four because a question the policies do not cover should
          return nothing, not the nearest miss. The two restaurants&apos; rules differ on purpose,
          so a section from the wrong restaurant would be a wrong decision, not just a wrong
          answer. <File path="api/app/policies/search.py" />
        </p>

        <Separator className="my-14" />
        <h2 id="proposals" className="mb-3 scroll-mt-28 text-2xl">
          Proposals and the checker
        </h2>
        <p>
          A proposal is structured: a kind, an order or customer, an amount or a discount, an
          audience, a draft message. Code checks it against a limits file kept beside each
          restaurant&apos;s policies: dispute windows per platform, the discount cap, the consent
          rule, the audience cap, the comp limit, the required opt-out wording. For a text
          campaign the checker counts the audience itself from the consent flags in the data and
          overwrites whatever the model claimed. A proposal ends pending, pending for the owner,
          or blocked with the reason. Nothing is sent, filed or comped at this point.{" "}
          <File path="api/app/agent/proposals.py" />
        </p>

        <Separator className="my-14" />
        <h2 id="citations" className="mb-3 scroll-mt-28 text-2xl">
          The citation check
        </h2>
        <p>
          The model cites the sections it used in brackets, like [House Policy §2, Comps]. After
          the answer, code checks every citation against the sections that were retrieved. A
          citation to a section the model was not shown fails the check. So does an answer that
          used policy and cites nothing. The answer still goes out, and the trace shows the failed
          check. On the site a citation opens the section it names.{" "}
          <File path="api/app/agent/loop.py" />
        </p>

        <Separator className="my-14" />
        <h2 id="approval" className="mb-3 scroll-mt-28 text-2xl">
          The approval step
        </h2>
        <p>
          A pending proposal waits on the trace page for a person to approve or reject it. Either
          choice appends a human step to the trace. Approval then appends a code step that writes
          a record of the action, labelled as simulated. No marketplace, phone or register is
          reached. This is the only path by which anything changes, and the model is not on it.{" "}
          <File path="api/app/routes/proposals.py" />
        </p>

        <Separator className="my-14" />
        <h2 id="trace" className="mb-3 scroll-mt-28 text-2xl">
          The trace and the cost
        </h2>
        <p>
          Every step is a row: who did it, the model, code or a person, what it decided, how long
          it took. Each model turn records its tokens, including how many came from the prompt
          cache, and the trace prices the request from the published rates. That is where the cost
          per question on the Evaluation page comes from. The Scenarios and Evaluation pages are
          rendered from these rows. <File path="api/app/agent/trace.py" />
        </p>

        <Separator className="my-14" />
        <h2 id="decisions" className="mb-3 scroll-mt-28 text-2xl">
          Decisions
        </h2>
        <ul className="list-disc space-y-3 pl-6">
          <li>
            <strong className="font-semibold">Python and sqlglot over Node.</strong> Validating
            generated SQL as a parse tree is the whole enforcement layer, and the JavaScript
            parsers are weaker.
          </li>
          <li>
            <strong className="font-semibold">No ORM.</strong> The premise is running generated
            SQL. An ORM would sit in the way. Queries go through psycopg directly.
          </li>
          <li>
            <strong className="font-semibold">Scoping by rewrite, not row-level security.</strong>{" "}
            Postgres row-level security would be the production answer. The rewrite is visible in
            the trace, which is what this project is for. The data is synthetic.
          </li>
          <li>
            <strong className="font-semibold">A threshold, not a top four.</strong> A question the
            policies do not cover should return nothing. The threshold is {s.retrieval_threshold.toFixed(2)},
            and the Evaluation page says why that is still an open question.
          </li>
          <li>
            <strong className="font-semibold">Sonnet 5.5 at medium effort.</strong> Opus gave the same
            outcomes at two and a half times the cost on the cases I have, and low effort did as
            well as medium. The eval decides this, not a preference.
          </li>
          <li>
            <strong className="font-semibold">Deterministic graders.</strong> No model grades
            another model. A case passes on a figure, a citation or a status the trace records.
          </li>
          <li>
            <strong className="font-semibold">Two databases from one schema.</strong> The demo
            database gets a new day of orders so the site never looks abandoned. The evaluation
            database is frozen so a score today compares with one next month.
          </li>
        </ul>

        <Separator className="my-14" />
        <h2 id="gaps" className="mb-3 scroll-mt-28 text-2xl">
          What it does not do
        </h2>
        <ul className="list-disc space-y-3 pl-6">
          <li>The two restaurants and their orders are generated. Nothing here is real sales.</li>
          <li>An approved action is recorded, not sent. No marketplace, SMS gateway or register is connected.</li>
          <li>The restaurant is chosen with a cookie. There is no login.</li>
          <li>Each evaluation setting ran once. The pass rates have no spread yet.</li>
          <li>Tenant isolation is enforced in the application, not in the database.</li>
        </ul>

        <p className="mt-14 text-base text-muted-foreground">
          FastAPI, psycopg, sqlglot, Postgres with pgvector, OpenAI text-embedding-3-small, Claude
          Sonnet 5.5, Next.js. One docker compose file runs all of it.
        </p>
      </article>
    </>
  );
}
