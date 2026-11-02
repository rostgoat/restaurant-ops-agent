import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MerchantBadge } from "@/components/merchant-badge";
import { OutcomeBadge } from "@/components/outcome-badge";
import type { RunRecord } from "@/lib/evaluation";

type Case = { id: string; question: string; merchant_id: number };

// One row per case, one column per run. A row whose outcome changed between
// runs is the thing a reader wants to find, so it is marked.
export function EveryCase({ cases, runs }: { cases: Case[]; runs: RunRecord[] }) {
  return (
    <>
      <p className="mb-3 text-sm text-muted-foreground sm:hidden">Swipe sideways to see every run.</p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Test</TableHead>
            <TableHead className="min-w-[11rem] sm:min-w-[18rem]">Question</TableHead>
            {runs.map((r, i) => (
              <TableHead key={r.run} className="w-10 text-center" title={`Run ${i + 1}`}>
                {i + 1}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {cases.map((c) => {
            const outcomes = runs.map((r) => r.outcomes[c.id]?.outcome ?? null);
            const changed = new Set(outcomes.filter(Boolean)).size > 1;

            return (
              <TableRow key={c.id} className={changed ? "bg-primary/5" : undefined}>
                <TableCell className="font-sql text-xs">
                  <Link href={`/evaluation/${c.id}`} className="text-primary underline-offset-4 hover:underline">
                    {c.id}
                  </Link>
                </TableCell>
                <TableCell className="min-w-[11rem] whitespace-normal sm:min-w-[18rem]">
                  {c.question}
                  <span className="mt-1 block">
                    <MerchantBadge merchantId={c.merchant_id} />
                  </span>
                </TableCell>
                {outcomes.map((o, i) => (
                  <TableCell key={runs[i].run} className="text-center">
                    {o ? (
                      <OutcomeBadge outcome={o} compact />
                    ) : (
                      <span role="img" aria-label="not run" title="not run" className="inline-block size-3 rounded-full border border-muted-foreground/40" />
                    )}
                  </TableCell>
                ))}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <p className="mt-3 text-sm text-muted-foreground">
        Columns are runs 1 to {runs.length}. Green passed, red failed, an empty circle means the test was not in that run.
      </p>
    </>
  );
}
