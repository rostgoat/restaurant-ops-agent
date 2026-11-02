import { ArchitectureDiagram } from "@/components/architecture-diagram";
import { Kicker } from "@/components/kicker";
import { pageMetadata } from "@/lib/site";
import { PageOutline } from "@/components/page-outline";
import { Separator } from "@/components/ui/separator";
import { data } from "@/lib/evaluation";
import { count } from "@/lib/format";

export const metadata = pageMetadata(
  "Architecture",
  "How the agent uses tools, checks SQL and policy citations, and submits actions for human approval. Includes implementation links, design choices, and limitations.",
  "/architecture",
);

const REPO = "https://github.com/rostgoat/restaurant-ops-agent/blob/main/";

const sections = [
  { slug: "tools", title: "Tools available to the model" },
  { slug: "guard", title: "SQL safety checks" },
  { slug: "database", title: "Query execution" },
  { slug: "retrieval", title: "Policy search" },
  { slug: "proposals", title: "Action proposals and checks" },
  { slug: "citations", title: "Citation checks" },
  { slug: "approval", title: "Human approval" },
  { slug: "trace", title: "Traces and costs" },
  { slug: "decisions", title: "Design choices" },
  { slug: "gaps", title: "Limitations" },
  { slug: "stack", title: "Technology and hosting" },
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

// The caching figure, read from the first evaluation case's answering turn.
const cached = (() => {
  const step = data.results[0].trace.steps.find((st) => st.name === "answer");
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
        <h1 className="mt-4 mb-10 text-4xl sm:text-5xl">How the agent handles a request</h1>
        <p>
          The <span className="font-semibold text-model">model</span> chooses tools and drafts an
          answer. <span className="font-semibold text-code">Code</span> checks its queries and
          action proposals before running them. A{' '}
          <span className="font-semibold text-human">person</span> reviews any allowed proposal.
          This demo records approved actions as simulations. The trace records the tool calls,
          checks, results, and approvals.
        </p>

        <ul className="mt-8 list-disc space-y-2 pl-6">
          <li>The model can submit SQL, search policies, draft actions, or decline a request.</li>
          <li>SQL checks restrict queries to read-only operations on one restaurant’s data.</li>
          <li>Policy search uses similarity and keywords, followed by a citation label check.</li>
          <li>Allowed proposals require human approval before a simulated action is recorded.</li>
          <li>Traces show the steps, token costs, and time taken.</li>
        </ul>

        <figure className="my-14">
          <ArchitectureDiagram />
          <figcaption className="mt-4 text-base text-muted-foreground">
            The main request steps, using the same actor colours as the trace.
            <span className="sm:hidden"> Scroll sideways to see the application steps.</span>
          </figcaption>
        </figure>

        <Separator className="my-14" />
        <h2 id="tools" className="mb-3 scroll-mt-28 text-2xl">
          Tools available to the model
        </h2>
        <p>
          The model receives the question and descriptions of the seven tables it can query.
          It has four tools: <Code>run_sql</Code> submits a <Code>SELECT</Code> query with a
          description of its purpose; <Code>search_policy</Code> searches the restaurant’s rules;
          <Code>propose</Code> drafts an action such as a dispute, text campaign, comp, or note;
          and <Code>decline</Code> turns down a request with an explanation.
        </p>
        <p className="mt-4">
          The model can make up to six tool calls per request or answer directly without a tool.
          The tools do not send messages, file disputes, change prices, or delete records. A
          request to change or delete data cannot give the model access to an operation these
          tools do not support. <File path="api/app/agent/tools.py" />
        </p>

        <Separator className="my-14" />
        <h2 id="guard" className="mb-3 scroll-mt-28 text-2xl">
          SQL safety checks
        </h2>
        <p>
          The SQL guard uses <Code>sqlglot</Code> to parse a query into a syntax tree. This lets it
          inspect SQL operations and table references directly, including queries with comments
          or unusual formatting.
        </p>
        <p className="mt-4">
          It checks eight conditions: valid syntax, one statement, a <Code>SELECT</Code> operation,
          no writes, no prohibited functions such as file or network access, only the seven
          permitted tables, queries limited to one restaurant, and a row limit.
        </p>
        <p className="mt-4">
          The guard adds the restaurant filter itself. It replaces each table reference with a
          filtered query containing only that restaurant’s rows. This also applies to tables
          inside joins and subqueries.
        </p>
        <p className="mt-4">
          When a check fails, the model receives the check name and can submit another query.
          If no query succeeds, the trace records the request as blocked.{' '}
          <File path="api/app/sql/guard.py" />
        </p>

        <Separator className="my-14" />
        <h2 id="database" className="mb-3 scroll-mt-28 text-2xl">
          Query execution
        </h2>
        <p>
          Queries run in read-only transactions with a five-second statement timeout. The
          database rejects writes and stops queries that exceed the timeout. The model receives
          at most 100 rows. The trace stores the same rows so a reader can compare the answer
          with the data the model received. <File path="api/app/sql/execute.py" />
        </p>

        <Separator className="my-14" />
        <h2 id="retrieval" className="mb-3 scroll-mt-28 text-2xl">
          Policy search
        </h2>
        <p>
          Each restaurant has three policy documents divided into numbered sections. Postgres
          stores each section with an embedding for similarity search, using <Code>pgvector</Code>,
          and an index of its words for keyword search. Both searches are limited to the asking
          restaurant before scoring. The two restaurants deliberately have different rules, so
          returning another restaurant’s policy can change the advice.
        </p>
        <p className="mt-4">
          Search ranks sections by embedding similarity and by matching keywords. Rare words
          receive more weight than common ones within the restaurant’s policies. The search
          combines the two rankings and returns up to four candidate sections.
        </p>
        <p className="mt-4">
          The model receives candidates whose similarity score meets the threshold of{' '}
          {s.retrieval_threshold.toFixed(2)}, plus the best keyword match even if its similarity
          score is lower. The trace records all candidates and identifies which search method
          qualified each section. If no candidate qualifies, the model is told there are no
          results.
        </p>
        <p className="mt-4">
          The threshold allows search to return no sections when the policies do not cover a
          question. I added keyword matching after similarity search repeatedly missed the
          Delivery Marketplaces section for a question about DoorDash.{' '}
          <File path="api/app/policies/search.py" />
        </p>

        <Separator className="my-14" />
        <h2 id="proposals" className="mb-3 scroll-mt-28 text-2xl">
          Action proposals and checks
        </h2>
        <p>
          A proposal contains structured fields such as action type, order or customer, amount,
          discount, audience, and draft message. The checker compares those fields with a limits
          file stored alongside each restaurant’s policies. The file defines dispute windows,
          discount and comp limits, consent requirements, audience caps, and opt-out wording.
        </p>
        <p className="mt-4">
          For a text campaign, the checker counts eligible customers from the database’s consent
          fields and replaces the model’s audience estimate with that count.
        </p>
        <p className="mt-4">
          The checker either blocks the proposal with a reason or leaves it pending for review,
          specifying when the owner must approve it. No message, dispute, or comp is carried out
          at this stage. <File path="api/app/agent/proposals.py" />
        </p>

        <Separator className="my-14" />
        <h2 id="citations" className="mb-3 scroll-mt-28 text-2xl">
          Citation checks
        </h2>
        <p>
          The model cites policy sections using full labels in brackets, such as
          [House Policy §2, Comps]. After it answers, code compares each label with the sections
          returned to the model. A citation fails if its label does not match a returned section.
          An answer with no citations also fails when the check requires them.
        </p>
        <p className="mt-4">
          A failed citation check is recorded in the trace but does not stop the answer from
          being displayed. Readers can open a citation to see the policy section. The check
          verifies the label, not whether the section supports the answer.{' '}
          <File path="api/app/agent/loop.py" />
        </p>

        <Separator className="my-14" />
        <h2 id="approval" className="mb-3 scroll-mt-28 text-2xl">
          Human approval
        </h2>
        <p>
          A person with the API token can approve or reject a pending proposal through the API.
          The site has no approval screen, and evaluation runs do not approve proposals. Either
          decision adds a human step to the trace. Approval also adds a code step that records
          a simulated action. It does not contact a marketplace, SMS provider, or register.
          The model does not participate in the approval step.{' '}
          <File path="api/app/routes/proposals.py" />
        </p>

        <Separator className="my-14" />
        <h2 id="trace" className="mb-3 scroll-mt-28 text-2xl">
          Traces and costs
        </h2>
        <p>
          Each trace step records its actor—model, code, or human—along with the operation,
          result, and duration.
        </p>
        <p className="mt-4">
          Model turns also record token usage, including prompt cache reads and writes. The
          application calculates request costs using its configured model rates. The Evaluation
          page adds those costs to show the total for each question and displays the saved
          steps. <File path="api/app/agent/trace.py" />
        </p>

        <Separator className="my-14" />
        <h2 id="decisions" className="mb-3 scroll-mt-28 text-2xl">
          Design choices
        </h2>
        <ul className="list-disc space-y-3 pl-6">
          <li>
            <strong className="font-semibold">Python API.</strong> I chose Python for
            <Code>sqlglot</Code>, which provides the SQL parser and query rewriting used by the
            guard.
          </li>
          <li>
            <strong className="font-semibold">Direct SQL access.</strong> Queries go through
            <Code>psycopg</Code>. The model supplies the SQL, so this query path does not use an
            ORM to generate it.
          </li>
          <li>
            <strong className="font-semibold">Restaurant filters added by the application.</strong>{' '}
            The guard rewrites queries so the trace can show exactly where restaurant filters
            were added. This demo uses generated data. Postgres row-level security would allow
            the database to enforce isolation as well; that is not implemented here.
          </li>
          <li>
            <strong className="font-semibold">Similarity threshold and keyword matching.</strong>{' '}
            The similarity threshold is {s.retrieval_threshold.toFixed(2)}. The best keyword
            match can also qualify below that threshold. The Evaluation page records the runs
            that led to these choices, including missed rules and irrelevant results.
          </li>
          <li>
            <strong className="font-semibold">Sonnet 5.5 at medium effort.</strong> In an early
            comparison on ten questions, Sonnet produced the same outcomes as Opus 5.5 at half
            the cost. Haiku later passed 38 of 39 evaluation tests at about one-twelfth the cost.
            It missed the Uber Eats dispute because it asked the owner for more information
            instead of submitting a proposal. I kept Sonnet because submitting actions for the
            checker is a central requirement. A Sonnet question costs about one cent.
          </li>
          <li>
            <strong className="font-semibold">Prompt caching.</strong> The system prompt, tool
            definitions, and table descriptions are reused across questions. About{' '}
            {count(cached.prompt)} tokens were read from cache on the first evaluation case’s
            answering turn: {count(cached.read)} of {count(cached.input)} input tokens. Cache
            reads cost one-tenth of the standard input rate. Each turn records cache usage, and
            the displayed cost includes it. Answers are generated for every request.
          </li>
          <li>
            <strong className="font-semibold">Grading in code.</strong> Tests compare the answer
            with expected figures, citations, phrases, or recorded statuses. They do not use
            another model as a judge.
          </li>
          <li>
            <strong className="font-semibold">Separate demo and evaluation databases.</strong>{' '}
            Both use the same schema. The demo data generator can append a day of orders, but
            there is no nightly job to run it. Evaluation data stays fixed so results from
            different runs can be compared.
          </li>
        </ul>

        <Separator className="my-14" />
        <h2 id="gaps" className="mb-3 scroll-mt-28 text-2xl">
          Limitations
        </h2>
        <ul className="list-disc space-y-3 pl-6">
          <li>The restaurants, policies, and orders are generated for the demo.</li>
          <li>Approved actions are simulated. No marketplace, SMS provider, or register is connected.</li>
          <li>
            There is no user login. The API receives the restaurant ID in a request header;
            evaluation runs pass it as a test parameter. An authenticated product would need to
            derive that ID from the user’s account.
          </li>
          <li>
            Most configurations have only one full evaluation run. Runs 8 and 10 used the same
            settings and agreed on every result. Some changes also had three repeats of an
            individual test. This provides limited evidence about variation between runs.
          </li>
          <li>The application enforces restaurant isolation; the database does not use row-level security.</li>
        </ul>

        <Separator className="my-14" />
        <h2 id="stack" className="mb-3 scroll-mt-28 text-2xl">
          Technology and hosting
        </h2>
        <ul className="list-disc space-y-3 pl-6">
          <li>
            <strong className="font-semibold">API.</strong> <Code>FastAPI</Code>, with{" "}
            <Code>psycopg</Code> for database access and <Code>sqlglot</Code> for SQL checks.
          </li>
          <li>
            <strong className="font-semibold">Database.</strong> Postgres, with <Code>pgvector</Code>{" "}
            for policy embeddings and Postgres full-text search for keyword matching.
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
            <strong className="font-semibold">Hosting.</strong> Locally, one{" "}
            <Code>docker compose</Code> file starts the database and API. The hosted site uses
            Vercel for the frontend, Fly for the API, and Neon for Postgres.
          </li>
        </ul>
      </article>
    </>
  );
}
