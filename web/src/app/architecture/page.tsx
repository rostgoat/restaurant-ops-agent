import { Separator } from "@/components/ui/separator";
import { ArchitectureDiagram } from "@/components/architecture-diagram";
import { Kicker } from "@/components/kicker";

export const metadata = { title: "Architecture" };

export default function ArchitecturePage() {
  return (
    <article className="text-lg leading-relaxed">
      <Kicker page="Architecture" />
      <h1 className="mt-4 mb-10 text-5xl">How a question becomes an answer</h1>
      <p>
        Every request passes through the same few steps, and the trace shows which of them the
        model did and which were done by ordinary code. The point of the split is that a wrong
        answer from the model cannot become a wrong action: code decides what is allowed to run.
      </p>

      <figure className="my-14">
        <ArchitectureDiagram />
        <figcaption className="mt-4 text-base text-muted-foreground">
          The request path. Each box is a step the trace records, in the colour the trace uses.
        </figcaption>
      </figure>

      <Separator className="my-14" />
      <h2 className="mb-3 text-2xl">The model proposes</h2>
      <p>
        The model sees a description of the seven tables it may read and the owner&apos;s question.
        It has three tools. <em>run_sql</em> proposes one SELECT statement and says what the query
        answers. <em>search_policy</em> asks for the sections of this restaurant&apos;s own written
        rules that bear on the question. <em>decline</em> turns the question down with a reason the
        owner will read, for questions that are not about this restaurant, that ask to change
        anything, or that carry instructions aimed at the model. It can also answer in plain text
        with no tool at all.
      </p>

      <Separator className="my-14" />
      <h2 className="mb-3 text-2xl">Code checks the query</h2>
      <p>
        The guard reads the proposed SQL as a parse tree, not as text, and runs eight checks in
        order: it parses, it is a single statement, it is a SELECT, it contains no write anywhere
        inside it, it calls no function that reads files or reaches the network, it touches only
        the seven permitted tables, and it fits under a row limit. The tenant check does not look
        for a filter; it adds one. Every table the query reads is replaced with a version already
        narrowed to the caller&apos;s restaurant, so a join or a subquery cannot escape it. The
        restaurant comes from the request, never from the question or the model.
      </p>
      <p>
        A blocked query goes back to the model as an error with the name of the check that
        failed. The model may rewrite it once. If nothing ever runs, the trace ends as
        <em> blocked</em> whatever the model says afterwards.
      </p>

      <Separator className="my-14" />
      <h2 className="mb-3 text-2xl">Code runs it</h2>
      <p>
        The rewritten query runs in a read-only transaction with a statement timeout, so even a
        query that slipped past the guard could not write or hang the database. The rows go back
        to the model, capped at a hundred, and the trace keeps exactly what the model saw.
      </p>

      <Separator className="my-14" />
      <h2 className="mb-3 text-2xl">Code finds the policy</h2>
      <p>
        Each restaurant&apos;s policies are stored one section at a time with an embedding, and a
        search looks only within the caller&apos;s restaurant before any similarity is computed,
        the same way the guard scopes a query. Sections below a similarity threshold are recorded
        in the trace but withheld from the model, and when nothing clears it the model is told so
        rather than handed the nearest miss. The two restaurants&apos; rules differ on purpose, so
        the wrong tenant&apos;s policy would be a wrong decision, not just a wrong answer.
      </p>
      <p>
        After an answer that used policy, code checks the citations: every section the answer
        cites in brackets must be one that was retrieved, and something must be cited at all.
        Either failure is recorded as a failed check in the trace.
      </p>

      <Separator className="my-14" />
      <h2 className="mb-3 text-2xl">The model answers</h2>
      <p>
        The model turns the rows into a few sentences. Each model turn records its own token
        counts, including how much of the prompt came from cache, and the trace prices the whole
        request from the published rates. That is where the cost per question comes from.
      </p>

      <Separator className="my-14" />
      <h2 className="mb-3 text-2xl">What is not built yet</h2>
      <p>
        The third lane, <em>Human</em>, is for the approval step: a proposal the model drafts, a
        person approves or rejects, and only then does code act. That path, and the evaluation
        set that scores all of this, come next.
      </p>
    </article>
  );
}
