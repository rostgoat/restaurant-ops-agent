import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Answer } from "@/components/answer";
import { Clock, Coins, ListOrdered, RotateCcw } from "lucide-react";
import type { Step, Trace } from "@/lib/api";
import { count, dollars, seconds } from "@/lib/format";
import { cn } from "@/lib/utils";

const lanes = ["human", "model", "code"] as const;
type Lane = (typeof lanes)[number];

const laneTitle: Record<Lane, string> = { model: "Model", code: "Code", human: "Human" };

const laneText: Record<Lane, string> = {
  model: "text-model",
  code: "text-code",
  human: "text-human",
};

const laneCell: Record<Lane, string> = {
  model: "border-model bg-model/8",
  code: "border-code bg-code/8",
  human: "border-human bg-human/8",
};

const laneStart: Record<Lane, string> = {
  human: "md:col-start-1 md:col-span-3",
  model: "md:col-start-2 md:col-span-2",
  code: "md:col-start-3 md:col-span-1",
};

export function TraceLedger({ trace, animate = false }: { trace: Trace; animate?: boolean }) {
  return (
    <section aria-label="Trace">
      <div className="hidden border-b font-heading text-sm md:grid md:grid-cols-[3fr_4fr_7fr]">
        {lanes.map((lane) => (
          <span key={lane} className={cn("px-5 py-3", laneText[lane])}>
            {laneTitle[lane]}
          </span>
        ))}
      </div>
      <ol className="mt-3 grid grid-cols-1 gap-y-3 md:grid-cols-[3fr_4fr_7fr]">
        <li className={cn("min-w-0 rounded-r-md border-l-4 px-5 py-4", laneCell.human, laneStart.human)}>
          <Badge variant="outline" className={cn("mb-2 font-heading", laneText.human)}>
            Human
          </Badge>
          <h3 className="mb-1 text-base">Asked</h3>
          <p className="text-muted-foreground">{trace.question}</p>
        </li>
        {trace.steps.map((step, i) => {
          const lane = step.actor as Lane;
          return (
            <li
              key={step.seq}
              className={cn(
                "min-w-0 rounded-r-md border-l-4 px-5 py-4",
                laneCell[lane],
                laneStart[lane],
                animate && "step-in"
              )}
              style={animate ? ({ "--i": i + 1 } as React.CSSProperties) : undefined}
            >
              <Badge variant="outline" className={cn("mb-2 font-heading", laneText[lane])}>
                {laneTitle[lane]}
              </Badge>
              <StepBody step={step} merchantId={trace.merchant_id} />
            </li>
          );
        })}
      </ol>
      <Outcome trace={trace} />
    </section>
  );
}

function Outcome({ trace }: { trace: Trace }) {
  return (
    <div className="mt-6">
      <TraceMeta trace={trace} />
    </div>
  );
}

export function TraceMeta({ trace }: { trace: Trace }) {
  const tokensIn =
    trace.usage.input_tokens + trace.usage.cache_read_tokens + trace.usage.cache_write_tokens;
  const items = [
    { icon: Coins, value: dollars(trace.cost_usd), label: "to answer" },
    {
      icon: Clock,
      value: seconds(trace.latency_ms),
      label: trace.model_ms > 0 ? `${seconds(trace.model_ms)} in the model` : "wall time",
    },
    {
      icon: ListOrdered,
      value: String(trace.steps.length),
      label: `${trace.steps.length === 1 ? "step" : "steps"}, ${count(tokensIn)} tokens in, ${count(trace.usage.output_tokens)} out`,
    },
  ];
  if (trace.retries > 0) {
    items.push({
      icon: RotateCcw,
      value: String(trace.retries),
      label: trace.retries === 1 ? "retry" : "retries",
    });
  }
  return (
    <div className="rounded-md bg-muted px-5 py-4">
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <StatusBadge status={trace.status} />
        {trace.status !== "answered" && <span className="text-sm">{statusLine(trace)}</span>}
      </p>
      <ul className="mt-3 flex flex-wrap gap-x-8 gap-y-2">
        {items.map((it) => (
          <li key={it.label} className="flex items-center gap-2">
            <it.icon className="size-4 text-muted-foreground" aria-hidden />
            <span className="font-heading text-base">{it.value}</span>
            <span className="text-sm text-muted-foreground">{it.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function statusLine(trace: Trace): string {
  switch (trace.status) {
    case "answered":
      return "Answered.";
    case "refused":
      return "Declined.";
    case "blocked": {
      const guard = trace.steps.find((s) => s.name === "guard" && s.outcome === "blocked");
      const check = guard?.detail?.blocked_by;
      return check ? `Blocked by the guard at the “${check}” check.` : "Blocked by the guard.";
    }
    default:
      return "Failed.";
  }
}

export function StatusBadge({ status }: { status: Trace["status"] }) {
  const label =
    status === "answered"
      ? "Answered"
      : status === "refused"
        ? "Declined"
        : status === "blocked"
          ? "Blocked"
          : "Failed";
  return (
    <Badge variant={status === "answered" ? "secondary" : "outline"} className="font-heading">
      {label}
    </Badge>
  );
}

function StepBody({ step, merchantId }: { step: Step; merchantId: number }) {
  const d = step.detail ?? {};
  switch (`${step.name}:${step.outcome}`) {
    case "run_sql:proposed":
      return (
        <>
          <Title>Proposed a query</Title>
          {typeof d.purpose === "string" && <p className="text-muted-foreground">{d.purpose}</p>}
          <Sql sql={String(d.sql ?? "")} />
          <Usage detail={d} />
        </>
      );
    case "guard:passed":
      return (
        <>
          <Title>Guard passed</Title>
          <Checks checks={d.checks} />
          {typeof d.sql === "string" && (
            <Collapsible className="mt-2">
              <CollapsibleTrigger asChild>
                <Button variant="link" size="sm" className="h-auto p-0 font-sans text-sm">
                  Show the query as it ran
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <Sql sql={d.sql} />
              </CollapsibleContent>
            </Collapsible>
          )}
        </>
      );
    case "guard:blocked":
      return (
        <>
          <Title>Guard blocked it at “{String(d.blocked_by)}”</Title>
          <p>{String(d.reason)}</p>
          <Checks checks={d.checks} />
        </>
      );
    case "execute:ok":
      return (
        <>
          <Title>
            Ran it: {count(Number(d.row_count ?? 0))} {Number(d.row_count) === 1 ? "row" : "rows"}{" "}
            in {seconds(step.latency_ms)}
          </Title>
          <Rows detail={d} />
        </>
      );
    case "execute:error":
      return (
        <>
          <Title>The database rejected it</Title>
          <p>{String(d.error)}</p>
        </>
      );
    case "answer:answered":
      return (
        <>
          <Title>Answered</Title>
          <Answer text={String(d.text)} merchantId={merchantId} className="text-lg" />
          <Usage detail={d} />
        </>
      );
    case "decline:declined":
      return (
        <>
          <Title>Declined</Title>
          <Answer text={String(d.reason)} merchantId={merchantId} className="text-lg" />
          <Usage detail={d} />
        </>
      );
    case "respond:refusal":
      return (
        <>
          <Title>The model refused</Title>
          {typeof d.category === "string" && <p>Category: {d.category}.</p>}
          <Usage detail={d} />
        </>
      );
    case "search_policy:proposed":
      return (
        <>
          <Title>Looked up the policy</Title>
          <p className="text-muted-foreground">&ldquo;{String(d.query)}&rdquo;</p>
          <Usage detail={d} />
        </>
      );
    case "retrieve:unavailable":
      return <Title>Policy search is not available</Title>;
    case "citations:passed":
      return (
        <>
          <Title>Citations checked</Title>
          <p className="text-muted-foreground">
            {Array.isArray(d.cited) && d.cited.length > 0
              ? `Every section cited was one that was retrieved: ${(d.cited as string[]).join("; ")}.`
              : "Nothing was retrieved and nothing was cited."}
          </p>
        </>
      );
    case "citations:failed":
      return (
        <>
          <Title>Citations failed</Title>
          <p>{String(d.reason)}.</p>
          {Array.isArray(d.not_retrieved) && d.not_retrieved.length > 0 && (
            <p className="text-muted-foreground">
              Not retrieved: {(d.not_retrieved as string[]).join("; ")}
            </p>
          )}
        </>
      );
    case "respond:max_tokens":
      return <Title>The model ran out of room before finishing</Title>;
    case "respond:error":
      return (
        <>
          <Title>The model call failed</Title>
          <p className="break-words">{String(d.error)}</p>
        </>
      );
    case "tool_limit:reached":
      return <Title>Stopped after {String(d.limit)} tool calls</Title>;
    default:
      if (step.name === "retrieve") return <Retrieved step={step} />;
      return (
        <>
          <Title>
            {step.name}: {step.outcome}
          </Title>
          {step.detail && (
            <pre className="font-sql text-sm whitespace-pre-wrap">
              {JSON.stringify(step.detail, null, 2)}
            </pre>
          )}
        </>
      );
  }
}

type RetrievedHit = { label: string; score: number; used: boolean };

function Retrieved({ step }: { step: Step }) {
  const d = step.detail ?? {};
  const hits = Array.isArray(d.hits) ? (d.hits as RetrievedHit[]) : [];
  const none = step.outcome === "nothing above threshold";
  return (
    <>
      <Title>{none ? "Nothing in the policies came close enough" : `Retrieved ${step.outcome}`}</Title>
      <p className="text-sm text-muted-foreground">
        Searched this restaurant&apos;s policies only. Threshold {String(d.threshold)}; the model
        saw only the sections above it.
      </p>
      <ul className="mt-2 space-y-1 text-sm">
        {hits.map((h) => (
          <li key={h.label} className={cn(!h.used && "text-muted-foreground")}>
            <span className="font-sql">{h.score.toFixed(2)}</span> {h.label}
            {!h.used && " (below threshold)"}
          </li>
        ))}
      </ul>
    </>
  );
}

function Title({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-1 text-base">{children}</h3>;
}

function Sql({ sql }: { sql: string }) {
  return (
    <pre className="mt-2 overflow-x-auto rounded-md bg-muted px-3 py-2 font-sql text-[13px] leading-relaxed whitespace-pre-wrap">
      {sql}
    </pre>
  );
}

type Check = { name: string; passed: boolean; detail: string | null };

function Checks({ checks }: { checks: unknown }) {
  if (!Array.isArray(checks)) return null;
  return (
    <ul className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
      {(checks as Check[]).map((c) => (
        <li key={c.name} className={cn(!c.passed && "font-semibold")}>
          {c.passed ? "✓" : "✕"} {c.name}
          {c.detail && <span className="text-muted-foreground">, {c.detail}</span>}
        </li>
      ))}
    </ul>
  );
}

function Rows({ detail }: { detail: Record<string, unknown> }) {
  const columns = Array.isArray(detail.columns) ? (detail.columns as string[]) : [];
  const rows = Array.isArray(detail.rows) ? (detail.rows as unknown[][]) : [];
  if (columns.length === 0) return null;
  const shown = rows.slice(0, 8);
  const hidden = rows.length - shown.length;
  return (
    <div className="mt-2">
      <Table className="w-auto font-sql text-[13px]">
        <TableHeader>
          <TableRow>
            {columns.map((c) => (
              <TableHead key={c} className="h-7 px-2 whitespace-nowrap">
                {c}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {shown.map((row, i) => (
            <TableRow key={i}>
              {row.map((v, j) => (
                <TableCell key={j} className="px-2 py-1 whitespace-nowrap">
                  {v === null ? "null" : String(v)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {hidden > 0 && (
        <p className="mt-1 text-sm text-muted-foreground">
          and {count(hidden)} more {hidden === 1 ? "row" : "rows"} the model saw
        </p>
      )}
    </div>
  );
}

function Usage({ detail }: { detail: Record<string, unknown> }) {
  const u = detail.usage as Record<string, number> | undefined;
  if (!u) return null;
  const cached = u.cache_read_tokens > 0 ? ` (${count(u.cache_read_tokens)} from cache)` : "";
  return (
    <p className="mt-2 text-sm text-muted-foreground">
      {count(u.input_tokens + u.cache_read_tokens + u.cache_write_tokens)} tokens in{cached},{" "}
      {count(u.output_tokens)} out
    </p>
  );
}
