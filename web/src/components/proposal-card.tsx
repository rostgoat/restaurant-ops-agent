import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Proposal } from "@/lib/api";
import { approveProposal, rejectProposal } from "@/app/actions";

const kindTitle: Record<string, string> = {
  file_dispute: "File a marketplace dispute",
  sms_campaign: "Text campaign",
  comp: "Comp an order",
  notify_owner: "Tell the owner",
  other: "Action",
};

type Check = { name: string; passed: boolean; detail: string };

export function ProposalCard({ proposal }: { proposal: Proposal }) {
  const checks = (proposal.payload.checks as Check[] | undefined) ?? [];
  const execution = proposal.payload.execution as
    | { result: string; artifact: string | null; simulated: string }
    | undefined;
  const needsOwner = Boolean(proposal.payload.needs_owner);
  return (
    <article className="rounded-lg border p-6">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={proposal.status === "pending" ? "default" : "outline"} className="font-heading">
          {proposal.status === "pending" && needsOwner ? "needs the owner" : proposal.status}
        </Badge>
        <span className="font-heading text-sm text-muted-foreground">
          {kindTitle[proposal.kind] ?? proposal.kind}
        </span>
      </div>
      <h2 className="mt-3 text-2xl">{proposal.summary}</h2>
      {typeof proposal.payload.reason === "string" && (
        <p className="mt-2 text-muted-foreground">{proposal.payload.reason}</p>
      )}
      {proposal.draft_message && (
        <blockquote className="mt-4 rounded-md bg-muted px-5 py-4 italic leading-relaxed">
          {proposal.draft_message}
        </blockquote>
      )}

      <h3 className="mt-6 mb-2 text-base">What code checked</h3>
      <ul className="space-y-1 text-sm">
        {checks.map((c) => (
          <li key={c.name} className={c.passed ? "" : "font-semibold"}>
            {c.passed ? "✓" : "✕"} {c.name}
            <span className="font-normal text-muted-foreground">, {c.detail}</span>
          </li>
        ))}
        {proposal.audience_size !== null && (
          <li className="text-muted-foreground">Audience counted by code: {proposal.audience_size}</li>
        )}
      </ul>
      {proposal.blocked_reason && (
        <p className="mt-3 text-sm">Blocked: {proposal.blocked_reason}.</p>
      )}

      {execution && (
        <div className="mt-6 rounded-md border-l-4 border-code bg-code/8 px-5 py-4">
          <p className="font-heading">{execution.result}</p>
          {execution.artifact && (
            <p className="mt-2 whitespace-pre-wrap text-sm">{execution.artifact}</p>
          )}
          <p className="mt-2 text-sm text-muted-foreground">{execution.simulated}</p>
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        {proposal.status === "pending" && (
          <>
            <form action={approveProposal}>
              <input type="hidden" name="id" value={proposal.id} />
              <Button type="submit" size="lg" className="h-11 px-5 font-heading text-base">
                Approve
              </Button>
            </form>
            <form action={rejectProposal}>
              <input type="hidden" name="id" value={proposal.id} />
              <Button type="submit" variant="outline" size="lg" className="h-11 px-5 font-heading text-base">
                Reject
              </Button>
            </form>
          </>
        )}
        <Button asChild variant="link" className="h-auto p-0 font-sans text-sm">
          <Link href={`/traces/${proposal.trace_id}`}>See the trace</Link>
        </Button>
      </div>
    </article>
  );
}
