import { ArchitectureDiagram } from "@/components/architecture-diagram";
import { Kicker } from "@/components/kicker";
import { pageMetadata } from "@/lib/site";
import { PageOutline } from "@/components/page-outline";
import { Separator } from "@/components/ui/separator";
import { data } from "@/lib/evaluation";
import { count } from "@/lib/format";
import { scenarios } from "@/lib/scenarios";

export const metadata = pageMetadata(
  "Architecture",
  "How a question becomes an answer: the model picks a tool, code checks and runs it, a person approves. One section per step with a link to the file, the decisions, and what it does not do.",
  "/architecture",
);

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
  { slug: "stack", title: "Stack" },
];

function Code({ children }: { children: string }) {
  return <code className="rounded-sm bg-muted px-1.5 py-0.5 font-sql text-[0.85em]">{children}</code>;
}

function File({ path }: { path: string }) {
  return (
    <a href={REPO + path} className="font-sql text-sm text-primary underline-offset-4 hover:underline">
      {path.split("/").pop()}
    </a>
  );
}

// The caching figure, read from the first scenario's answering turn.
const cached = (() => {
  const step = scenarios[0].trace.steps.find((st) => st.name === "answer");
  const u = (step?.detail as { usage?: Record<string, number> } | undefined)?.usage ?? {};
  const read = u.cache_read_tokens ?? 0;
  const input = (u.input_tokens ?? 0) + read + (u.cache_write_tokens ?? 0);

  return { read, input, prompt: Math.round(read / 10) * 10 };
})();

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
          what runs. A person decides what happens. The model cannot run a query, send a message or
          file a dispute. Only code and a person can, and the trace records every step.
        </p>

        <ul className="mt-8 list-disc space-y-2 pl-6">
          <li>
            The model writes SQL, searches the policies and drafts actions. It cannot run a query,
            send a message or file a dispute.
          </li>
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
          four tools. <Code>run_sql</Code> writes one <Code>SELECT</Code> and says what it answers.{" "}
          <Code>search_policy</Code> asks for the rules on a topic. <Code>propose</Code> drafts an
          action: a dispute, a text campaign, a comp or a note to the owner. <Code>decline</Code>{" "}
          turns the question down and says why. The model can call up
          to six tools in one request, in any order, or answer in plain text with none. None of the
          four can write, send or file anything. A question that tells the model to delete or
          change something, like the injection scenario, has no tool to do it with.{" "}
          <File path="api/app/agent/tools.py" />
        </p>

        <Separator className="my-14" />
        <h2 id="guard" className="mb-3 scroll-mt-28 text-2xl">
          The guard
        </h2>
        <p>
          The guard takes the SQL apart with <Code>sqlglot</Code> into the parts the database would see, a
          parse tree, instead of reading it as text. A string match misses a write hidden behind a
          comment or odd casing. A parsed query cannot hide one. It runs eight
          checks: the query parses, it is one statement, it is a <Code>SELECT</Code>, it contains no write, it
          calls no function that reads files or reaches the network, it reads only the seven
          allowed tables, it is scoped to one restaurant, and it fits under a row limit. The scope
          check does not look for a restaurant filter in the query. It adds one. Every table in the query is replaced
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
          Each section is stored with an embedding in Postgres, using <Code>pgvector</Code>. A search is
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
          reached. This is the only way anything changes. The model has no step in it.{" "}
          <File path="api/app/routes/proposals.py" />
        </p>

        <Separator className="my-14" />
        <h2 id="trace" className="mb-3 scroll-mt-28 text-2xl">
          The trace and the cost
        </h2>
        <p>
          Every step is a row: who did it, the model, code or a person, what it decided, how long
          it took. Each model turn records its tokens, including how many came from the prompt
          cache, and the trace prices the request from the published rates. The cost per question
          on the Evaluation page is the sum of those rows. The Scenarios and Evaluation pages are
          rendered from these rows. <File path="api/app/agent/trace.py" />
        </p>

        <Separator className="my-14" />
        <h2 id="decisions" className="mb-3 scroll-mt-28 text-2xl">
          Decisions
        </h2>
        <ul className="list-disc space-y-3 pl-6">
          <li>
            <strong className="font-semibold">Python and <Code>sqlglot</Code> over Node.</strong>{" "}
            <Code>sqlglot</Code> parses SQL into a tree and lets the guard rewrite it. The guard is
            the enforcement layer, so the API is written in the language that has the parser.
          </li>
          <li>
            <strong className="font-semibold">No ORM.</strong> The model writes the SQL. An ORM
            writes SQL for you, which is the opposite of what this project does. Queries go
            through <Code>psycopg</Code> directly.
          </li>
          <li>
            <strong className="font-semibold">Scoping by rewrite, not row-level security.</strong>{" "}
            Row-level security would do this job inside Postgres. I rewrite the query instead so the
            trace can show the filter being added. The data is generated, so there is nothing to
            protect.
          </li>
          <li>
            <strong className="font-semibold">A threshold, not a top four.</strong> A question the
            policies do not cover should return nothing. The threshold is {s.retrieval_threshold.toFixed(2)},
            and the Evaluation page says why that is still an open question.
          </li>
          <li>
            <strong className="font-semibold">Sonnet 5.5 at medium effort.</strong> On the evaluation
            cases Opus passed fewer and cost two and a half times as much. Low effort did as well
            as medium. The evaluation chose the model.
          </li>
          <li>
            <strong className="font-semibold">Prompt caching.</strong> The system prompt, the
            tool definitions and the table descriptions are the same for every question, about{" "}
            {count(cached.prompt)} tokens. They are cached, so every turn after the first reads
            them at a tenth of the price. On the first scenario&apos;s answering turn,{" "}
            {count(cached.read)} of {count(cached.input)} input tokens came from the cache. The
            trace records this on every turn and the cost per question includes it. Answers are
            not cached. Every question is a live run.
          </li>
          <li>
            <strong className="font-semibold">Deterministic graders.</strong> No model grades
            another model. A case passes on a figure, a citation or a status the trace records.
          </li>
          <li>
            <strong className="font-semibold">Two databases from one schema.</strong> The demo
            database serves the site and the reruns. The generator can append one day of orders
            to it at a time, and the job that would do that nightly is not built. The evaluation
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
          <li>
            There is no login. On the Ask page you pick a restaurant, the choice is stored in a
            cookie, and the server sends it to the API as the restaurant id. In a real product the
            id would come from the account.
          </li>
          <li>Each evaluation setting ran once. The pass rates have no spread yet.</li>
          <li>Tenant isolation is enforced in the application, not in the database.</li>
        </ul>

        <Separator className="my-14" />
        <h2 id="stack" className="mb-3 scroll-mt-28 text-2xl">
          Stack
        </h2>
        <ul className="list-disc space-y-3 pl-6">
          <li>
            <strong className="font-semibold">API.</strong> <Code>FastAPI</Code>, with{" "}
            <Code>psycopg</Code> for the database and <Code>sqlglot</Code> for the guard.
          </li>
          <li>
            <strong className="font-semibold">Database.</strong> Postgres with <Code>pgvector</Code>{" "}
            for the policy embeddings.
          </li>
          <li>
            <strong className="font-semibold">Embeddings.</strong> OpenAI{" "}
            <Code>text-embedding-3-small</Code>.
          </li>
          <li>
            <strong className="font-semibold">Model.</strong> Claude Sonnet 5.5 at medium effort.
          </li>
          <li>
            <strong className="font-semibold">Site.</strong> <Code>Next.js</Code>.
          </li>
          <li>
            <strong className="font-semibold">Running it.</strong> Locally, one{" "}
            <Code>docker compose</Code> file runs the database, the API and the site. Deployed,
            the site will run on Vercel and the API and the database will run separately.
          </li>
        </ul>
      </article>
    </>
  );
}
