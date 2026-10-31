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
    <Table className="min-w-[720px]">
      <TableHeader>
        <TableRow>
          <TableHead>Case</TableHead>
          <TableHead>Question</TableHead>
          <TableHead>Asked as</TableHead>
          {runs.map((r, i) => (
            <TableHead key={r.run} className="whitespace-nowrap">
              Run {i + 1}
              <span className="ml-1 font-sql text-xs font-normal text-muted-foreground">{r.retrieval_threshold.toFixed(2)}</span>
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
              <TableCell className="whitespace-normal">{c.question}</TableCell>
              <TableCell className="whitespace-nowrap">
                <MerchantBadge merchantId={c.merchant_id} />
              </TableCell>
              {outcomes.map((o, i) => (
                <TableCell key={runs[i].run}>
                  {o ? <OutcomeBadge outcome={o} /> : <span className="text-xs text-muted-foreground">not run</span>}
                </TableCell>
              ))}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

// "Run 1 pass, Run 2 fail": a case's outcome in every run, for a card or page.
export function RunHistory({ id, runs }: { id: string; runs: RunRecord[] }) {
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
      {runs.map((r, i) => {
        const o = r.outcomes[id]?.outcome;

        return (
          <span key={r.run} className="inline-flex items-center gap-1">
            Run {i + 1} {o ? <OutcomeBadge outcome={o} /> : <span className="text-xs">not run</span>}
          </span>
        );
      })}
    </p>
  );
}
