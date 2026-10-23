import type { Step, Trace } from "@/lib/api";
import { count, dollars, seconds } from "@/lib/format";

const lanes = ["model", "code", "human"] as const;
type Lane = (typeof lanes)[number];

const laneTitle: Record<Lane, string> = {
  model: "Model",
  code: "Code",
  human: "Human",
};

const laneColor: Record<Lane, string> = {
  model: "text-model border-model",
  code: "text-code border-code",
  human: "text-human border-human",
};

export function TraceLedger({ trace, animate = false }: { trace: Trace; animate?: boolean }) {
  return (
    <section aria-label="Trace">
      <ol className="border-t border-rule">
        <li className="hidden md:grid md:grid-cols-3 border-b border-rule font-display text-sm">
          {lanes.map((lane) => (
            <span key={lane} className={`px-3 py-2 ${laneColor[lane].split(" ")[0]}`}>
              {laneTitle[lane]}
            </span>
          ))}
        </li>
        {trace.steps.map((step, i) => (
          <li
            key={step.seq}
            className={`grid grid-cols-1 md:grid-cols-3 border-b border-rule ${animate ? "step-in" : ""}`}
            style={animate ? ({ "--i": i } as React.CSSProperties) : undefined}
          >
            {lanes.map((lane) => (
              <div key={lane} className={`min-w-0 ${lane === step.actor ? "" : "hidden md:block"}`}>
                {lane === step.actor && (
                  <div className={`border-l-4 px-3 py-3 ${laneColor[lane]}`}>
                    <p className="md:hidden font-display text-sm">{laneTitle[lane]}</p>
                    <div className="text-ink">
                      <StepBody step={step} />
                    </div>
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
  return (
    <p className="mt-3 text-sm text-muted">
      {statusLine(trace)} {dollars(trace.cost_usd)}, {seconds(trace.latency_ms)}
      {trace.model_ms > 0 && ` (${seconds(trace.model_ms)} in the model)`},{" "}
      {count(trace.usage.input_tokens + trace.usage.cache_read_tokens + trace.usage.cache_write_tokens)}{" "}
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

function StepBody({ step }: { step: Step }) {
  const d = step.detail ?? {};
  switch (`${step.name}:${step.outcome}`) {
    case "run_sql:proposed":
      return (
        <>
          <Title>Proposed a query</Title>
          {typeof d.purpose === "string" && <p className="text-muted">{d.purpose}</p>}
          <Sql sql={String(d.sql ?? "")} />
          <Usage detail={d} />
        </>
      );
    case "guard:passed":
      return (
        <>
          <Title>Guard passed</Title>
          <Checks checks={d.checks} />
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
            Ran it: {count(Number(d.row_count ?? 0))} {Number(d.row_count) === 1 ? "row" : "rows"} in{" "}
            {seconds(step.latency_ms)}
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
          <p className="text-lg leading-relaxed">{String(d.text)}</p>
          <Usage detail={d} />
        </>
      );
    case "decline:declined":
      return (
        <>
          <Title>Declined</Title>
          <p className="text-lg leading-relaxed">{String(d.reason)}</p>
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
    case "query_limit:reached":
      return <Title>Stopped after {String(d.limit)} queries</Title>;
    default:
      return (
        <>
          <Title>
            {step.name}: {step.outcome}
          </Title>
          {step.detail && <pre className="font-sql text-sm whitespace-pre-wrap">{JSON.stringify(step.detail, null, 2)}</pre>}
        </>
      );
  }
}

function Title({ children }: { children: React.ReactNode }) {
  return <h3 className="text-base mb-1">{children}</h3>;
}

function Sql({ sql }: { sql: string }) {
  return (
    <pre className="mt-2 overflow-x-auto rounded-sm bg-tint px-3 py-2 font-sql text-[13px] leading-relaxed whitespace-pre-wrap">
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
        <li key={c.name} className={c.passed ? "" : "font-semibold"}>
          {c.passed ? "✓" : "✕"} {c.name}
          {c.detail && <span className="text-muted">, {c.detail}</span>}
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
  return (
    <div className="mt-2 overflow-x-auto">
      <table className="font-sql text-[13px] leading-relaxed">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c} className="pr-3 text-left font-normal text-muted whitespace-nowrap">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shown.map((row, i) => (
            <tr key={i}>
              {row.map((v, j) => (
                <td key={j} className="pr-3 align-top whitespace-nowrap">
                  {v === null ? "null" : String(v)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > shown.length && (
        <p className="mt-1 text-sm text-muted">
          and {count(rows.length - shown.length)} more {rows.length - shown.length === 1 ? "row" : "rows"} the model saw
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
    <p className="mt-2 text-sm text-muted">
      {count(u.input_tokens + u.cache_read_tokens + u.cache_write_tokens)} tokens in{cached}, {count(u.output_tokens)} out
    </p>
  );
}
