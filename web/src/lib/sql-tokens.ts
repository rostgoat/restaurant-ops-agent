export type SqlToken = { type: "keyword" | "string" | "number" | "comment" | "plain"; text: string };

const KEYWORDS = new Set(
  `select from where and or not as on join left right inner full outer cross group by order
   limit offset with filter having case when then else end distinct in between is null like
   ilike union all except intersect extract cast interval at time zone desc asc over partition
   exists coalesce nullif true false date timestamptz timestamp`.split(/\s+/),
);

const TOKEN = /--[^\n]*|'(?:[^']|'')*'|\b\d+(?:\.\d+)?\b|\b[A-Za-z_][A-Za-z0-9_]*\b|[\s\S]/g;

export function tokenize(sql: string): SqlToken[] {
  const tokens: SqlToken[] = [];

  for (const [text] of sql.matchAll(TOKEN)) {
    tokens.push({ type: classify(text), text });
  }

  return merged(tokens);
}

function classify(text: string): SqlToken["type"] {
  if (text.startsWith("--")) return "comment";

  if (text.startsWith("'")) return "string";

  if (/^\d/.test(text)) return "number";

  if (KEYWORDS.has(text.toLowerCase())) return "keyword";

  return "plain";
}

function merged(tokens: SqlToken[]): SqlToken[] {
  const out: SqlToken[] = [];

  for (const t of tokens) {
    const last = out[out.length - 1];

    if (last && last.type === "plain" && t.type === "plain") {
      last.text += t.text;
    } else {
      out.push({ ...t });
    }
  }

  return out;
}
