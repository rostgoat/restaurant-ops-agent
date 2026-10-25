import Link from "next/link";
import { Kicker } from "@/components/kicker";
import { PageOutline } from "@/components/page-outline";
import { AskForm } from "@/components/ask-form";
import { MerchantPicker } from "@/components/merchant-picker";
import { StatusBadge, statusLine } from "@/components/trace";
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

export const metadata = { title: "Ask" };

export default async function AskPage() {
  return (
    <>
      <PageOutline
        items={[
          { slug: "ask", title: "Ask a question" },
          { slug: "recent", title: "Recent questions" },
        ]}
      />
      <section id="ask" className="max-w-[64ch] scroll-mt-28">
        <Kicker page="Ask" />
        <h1 className="mt-4 text-4xl sm:text-5xl">Ask it yourself</h1>
        <p className="mt-8 text-lg leading-relaxed text-muted-foreground">
          Pick one of the two restaurants and ask anything about its sales or its written
          policies. One of the suggestions asks the agent to delete data, so you can watch it
          refuse. A question costs a few cents and takes ten seconds or so; the trace appears
          below the form when it is done.
        </p>
      </section>
      <div className="mt-16">
        <Workspace />
      </div>
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
      <section id="recent" className="scroll-mt-28">
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
