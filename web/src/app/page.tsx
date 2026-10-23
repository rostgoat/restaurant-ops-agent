import Link from "next/link";
import { AskForm } from "@/components/ask-form";
import { MerchantPicker } from "@/components/merchant-picker";
import { statusLine } from "@/components/trace";
import { ApiUnreachable, getMerchants, getRecentTraces } from "@/lib/api";
import { dollars } from "@/lib/format";
import { currentMerchant } from "@/lib/merchant";

// Rendered in full on every request rather than streamed behind a fallback:
// a visitor opening the link cold should never see a loading state.
export const instant = false;

export default async function AskPage() {
  return (
    <>
      <h1 className="text-4xl mb-2">Ask the data a question</h1>
      <p className="max-w-[68ch] text-muted mb-8">
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
        <h2 className="text-2xl mb-3">Recent questions</h2>
        {traces.length === 0 ? (
          <p className="text-muted">No questions yet for this restaurant. Ask one above.</p>
        ) : (
          <ul className="max-w-[68ch] divide-y divide-rule border-y border-rule">
            {traces.map((t) => (
              <li key={t.id} className="py-3">
                <Link href={`/traces/${t.id}`} className="hover:underline underline-offset-4">
                  {t.question}
                </Link>
                <p className="text-sm text-muted">
                  {statusLine(t)} {dollars(t.cost_usd)}, {t.steps.length} steps.
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function Unreachable({ error }: { error: unknown }) {
  const message = error instanceof ApiUnreachable ? error.message : "The API returned an error.";
  return (
    <p className="max-w-[68ch]">
      {message} Start it with{" "}
      <code className="font-sql text-sm">cd api && .venv/bin/uvicorn app.main:app</code> and
      reload.
    </p>
  );
}
