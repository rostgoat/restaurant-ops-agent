import { format } from "sql-formatter";
import { Clamped } from "@/components/clamped";
import { Sql } from "@/components/trace";

// The query a person wrote for what the question means, beside the query
// the model wrote. When the figures differ, the difference is in here.
export function TwoQueries({ gold, model }: { gold: string; model: string | null }) {
  return (
    <div className="grid gap-8 md:grid-cols-2">
      <div>
        <h3 className="mb-1 text-base">Reference query</h3>
        <p className="text-sm text-muted-foreground">
          I wrote this query to calculate the expected answer on the fixed test database.
        </p>
        <Clamped label="the reference query">
          <Sql sql={stripHeader(gold)} />
        </Clamped>
      </div>
      <div>
        <h3 className="mb-1 text-base">Agent query</h3>
        <p className="text-sm text-muted-foreground">
          The agent’s last query, formatted for readability. The trace includes the original SQL
          and the version run after the safety checks added a restaurant filter and row limit.
        </p>
        {model ? (
          <Clamped label="the agent’s query">
            <Sql sql={readable(model)} />
          </Clamped>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">The agent did not submit a query.</p>
        )}
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
