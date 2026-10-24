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
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Step, Trace } from "@/lib/api";
import { count, dollars, seconds } from "@/lib/format";
import { cn } from "@/lib/utils";

const lanes = ["model", "code", "human"] as const;
type Lane = (typeof lanes)[number];

const laneTitle: Record<Lane, string> = { model: "Model", code: "Code", human: "Human" };

const laneText: Record<Lane, string> = {
  model: "text-model",
  code: "text-code",
  human: "text-human",
};

const laneCell: Record<Lane, string> = {
  model: "border-model bg-model/5",
  code: "border-code bg-code/5",
  human: "border-human bg-human/5",
};

export function TraceLedger({ trace, animate = false }: { trace: Trace; animate?: boolean }) {
  return (
    <section aria-label="Trace">
      <ol className="border-t bg-card">
        <li className="hidden border-b font-heading text-sm md:grid md:grid-cols-[5fr_6fr_3fr]">
          {lanes.map((lane) => (
            <span key={lane} className={cn("px-5 py-3", laneText[lane])}>
              {laneTitle[lane]}
            </span>
          ))}
        </li>
        {trace.steps.map((step, i) => (
          <li
            key={step.seq}
            className={cn("grid grid-cols-1 border-b md:grid-cols-[5fr_6fr_3fr]", animate && "step-in")}
            style={animate ? ({ "--i": i } as React.CSSProperties) : undefined}
          >
            {lanes.map((lane) => (
              <div key={lane} className={cn("min-w-0", lane !== step.actor && "hidden md:block")}>
                {lane === step.actor && (
                  <div className={cn("h-full border-l-4 px-5 py-5", laneCell[lane])}>
                    <Badge
                      variant="outline"
                      className={cn("mb-1 font-heading md:hidden", laneText[lane])}
                    >
                      {laneTitle[lane]}
                    </Badge>
                    <StepBody step={step} />
                  </div>
                )}
              </div>
            ))}
          </li>
        ))}
      </ol>
      <Outcome trace={trace} />
    </section>
  );
}

function Outcome({ trace }: { trace: Trace }) {
  const tokensIn =
    trace.usage.input_tokens + trace.usage.cache_read_tokens + trace.usage.cache_write_tokens;
  return (
    <p className="mt-5 text-sm text-muted-foreground">
      {statusLine(trace)} {dollars(trace.cost_usd)}, {seconds(trace.latency_ms)}
      {trace.model_ms > 0 && ` (${seconds(trace.model_ms)} in the model)`}, {count(tokensIn)}{" "}
      tokens in, {count(trace.usage.output_tokens)} out
      {trace.retries > 0 && `, ${trace.retries} ${trace.retries === 1 ? "retry" : "retries"}`}.
    </p>
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

function StepBody({ step }: { step: Step }) {
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
          <Prose text={String(d.text)} />
          <Usage detail={d} />
        </>
      );
    case "decline:declined":
      return (
        <>
          <Title>Declined</Title>
          <Prose text={String(d.reason)} />
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

function Prose({ text }: { text: string }) {
  return (
    <div className="space-y-3 text-lg leading-relaxed [&_li]:ml-5 [&_ol]:list-decimal [&_table]:w-full [&_table]:text-base [&_td]:border-t [&_td]:py-1.5 [&_td]:pr-3 [&_th]:py-1.5 [&_th]:pr-3 [&_th]:text-left [&_th]:font-normal [&_th]:text-muted-foreground [&_ul]:list-disc">
      <Markdown remarkPlugins={[remarkGfm]}>{text}</Markdown>
    </div>
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
