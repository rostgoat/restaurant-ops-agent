import Link from "next/link";
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

export default async function AskPage() {
  return (
    <>
      <h1 className="mb-2 text-4xl">Ask the data a question</h1>
      <p className="mb-8 max-w-[68ch] text-muted-foreground">
        The model writes one SQL query at a time. Code checks it before it runs, then the
        model explains the rows. Every step is recorded and shown below, tagged by who did it.
      </p>
      <Workspace />
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
    <>
      <div className="mb-6">
        <MerchantPicker merchants={merchants} current={merchant.id} />
      </div>
      <AskForm merchantName={merchant.name} />
      <section className="mt-14">
        <h2 className="mb-3 text-2xl">Recent questions</h2>
        {traces.length === 0 ? (
          <p className="text-muted-foreground">
            No questions yet for this restaurant. Ask one above.
          </p>
        ) : (
          <Table className="max-w-[80ch]">
            <TableHeader>
              <TableRow>
                <TableHead>Question</TableHead>
                <TableHead>Outcome</TableHead>
                <TableHead className="text-right">Cost</TableHead>
                <TableHead className="text-right">Steps</TableHead>
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
                  <TableCell className="text-right">{t.steps.length}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </>
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
