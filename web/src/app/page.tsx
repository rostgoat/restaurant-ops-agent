import Link from "next/link";
import { AskForm } from "@/components/ask-form";
import { CapturedRun } from "@/components/captured-run";
import { MerchantPicker } from "@/components/merchant-picker";
import { StatusBadge, statusLine } from "@/components/trace";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ApiUnreachable, getMerchants, getRecentTraces } from "@/lib/api";
import { dollars } from "@/lib/format";
import { currentMerchant } from "@/lib/merchant";

// Rendered in full on every request rather than streamed behind a fallback:
// a visitor opening the link cold should never see a loading state.
export const instant = false;

const actors = [
  {
    name: "Model",
    verb: "proposes",
    color: "text-model",
    text: "Reads the question, writes one SQL query, and once the rows come back explains them in plain language.",
  },
  {
    name: "Code",
    verb: "decides",
    color: "text-code",
    text: "Reads the query as a parse tree, refuses anything that writes, scopes it to one restaurant, and runs it read-only with a timeout.",
  },
  {
    name: "Human",
    verb: "approves",
    color: "text-human",
    text: "When the agent proposes an action rather than an answer, a person says yes or no before anything happens. This part is next.",
  },
];

const evidence = [
  {
    figure: "8",
    label: "checks that run without the model, before any query touches the database",
    href: "/architecture",
  },
  {
    figure: "Next",
    label: "eval cases passing. The evaluation lab is the next thing built, and its numbers go here, good or bad",
    href: null,
  },
  {
    figure: "Next",
    label: "cost per merchant per month, priced from every traced request",
    href: null,
  },
];

export default async function AskPage() {
  return (
    <>
      <section className="mx-auto max-w-[56ch] text-center">
        <h1 className="mx-auto max-w-[18ch] text-5xl sm:text-6xl">
          An agent that shows its work and cannot act alone.
        </h1>
        <p className="mt-8 text-xl leading-relaxed text-muted-foreground">
          A restaurant owner asks about their sales in plain words. The model writes the SQL,
          code decides whether it may run, and a person approves anything that would change
          something. Every step is recorded, priced, and shown.
        </p>
        <p className="mt-6 text-base text-muted-foreground">
          A case study by Rost M in making an AI agent reliable.{" "}
          <Button asChild variant="link" className="h-auto p-0 font-sans text-base">
            <a href="https://github.com/rostgoat/restaurant-ops-agent">View the code</a>
          </Button>
        </p>
      </section>

      <section className="mx-auto mt-20 grid max-w-4xl gap-8 sm:grid-cols-3">
        {evidence.map((e) => (
          <div key={e.label} className="border-t pt-4">
            <p className="font-heading text-3xl">{e.figure}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {e.href ? (
                <Link href={e.href} className="underline-offset-4 hover:underline">
                  {e.label}
                </Link>
              ) : (
                e.label
              )}
            </p>
          </div>
        ))}
      </section>

      <section className="mt-28 grid gap-12 sm:grid-cols-3 sm:gap-10">
        {actors.map((a) => (
          <div key={a.name}>
            <h2 className="text-2xl">
              <span className={a.color}>{a.name}</span> {a.verb}
            </h2>
            <p className="mt-4 text-muted-foreground">{a.text}</p>
          </div>
        ))}
      </section>

      <CapturedRun />

      <section className="mt-32">
        <h2 className="mb-4 text-3xl">Try it</h2>
        <p className="mb-12 max-w-[60ch] text-lg text-muted-foreground">
          Pick one of the two fictional restaurants, ask anything about its sales, and watch the
          trace. One of the suggestions asks the agent to delete data, so you can see it refuse.
        </p>
        <Workspace />
      </section>
    </>
  );
}

async function Workspace() {
  const merchantId = await currentMerchant();
  let merchants;
  try {
    merchants = await getMerchants();
  } catch (e) {
    return <Unreachable error={e} />;
  }
  const merchant = merchants.find((m) => m.id === merchantId) ?? merchants[0];
  const traces = await getRecentTraces(merchant.id);
  return (
    <div className="grid gap-16 md:grid-cols-2 md:gap-20">
      <div>
        <div className="mb-8">
          <MerchantPicker merchants={merchants} current={merchant.id} />
        </div>
        <AskForm merchantName={merchant.name} />
      </div>
      <section>
        <h3 className="mb-4 text-2xl">Recent questions</h3>
        {traces.length === 0 ? (
          <p className="text-muted-foreground">
            No questions yet for this restaurant. Ask the first one.
          </p>
        ) : (
          <Table className="bg-card">
            <TableHeader>
              <TableRow>
                <TableHead>Question</TableHead>
                <TableHead>Outcome</TableHead>
                <TableHead className="text-right">Cost</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {traces.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="whitespace-normal">
                    <Link href={`/traces/${t.id}`} className="underline-offset-4 hover:underline">
                      {t.question}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={t.status} />
                    <span className="sr-only">{statusLine(t)}</span>
                  </TableCell>
                  <TableCell className="text-right font-sql text-[13px]">
                    {dollars(t.cost_usd)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  );
}

function Unreachable({ error }: { error: unknown }) {
  const message = error instanceof ApiUnreachable ? error.message : "The API returned an error.";
  return (
    <Alert variant="destructive" className="max-w-[68ch]">
      <AlertTitle>{message}</AlertTitle>
      <AlertDescription>
        Start it with <code className="font-sql">cd api && .venv/bin/uvicorn app.main:app</code>{" "}
        and reload.
      </AlertDescription>
    </Alert>
  );
}
