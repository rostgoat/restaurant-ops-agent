import { format } from "sql-formatter";
import { Sql } from "@/components/trace";

// The query a person wrote for what the question means, beside the query
// the model wrote. When the figures differ, the difference is in here.
export function TwoQueries({ gold, model }: { gold: string; model: string | null }) {
  return (
    <div className="grid gap-8 md:grid-cols-2">
      <div>
        <h3 className="mb-1 text-base">The query I wrote</h3>
        <p className="text-sm text-muted-foreground">
          The question read the way the owner means it. Run on the frozen database for the figure the grader
          expects.
        </p>
        <Sql sql={stripHeader(gold)} />
      </div>
      <div>
        <h3 className="mb-1 text-base">The query the model wrote</h3>
        <p className="text-sm text-muted-foreground">
          Its last query, laid out for reading. The trace has it as sent. The guard added the restaurant filter
          and the row limit before it ran.
        </p>
        {model ? <Sql sql={readable(model)} /> : <p className="mt-2 text-sm text-muted-foreground">No query ran.</p>}
      </div>
    </div>
  );
}

function readable(sql: string): string {
  try {
    return format(sql, { language: "postgresql", keywordCase: "upper", expressionWidth: 72 });
  } catch {
    return sql;
  }
}

function stripHeader(sql: string): string {
  return sql.replace(/^--.*\n\n?/, "");
}
