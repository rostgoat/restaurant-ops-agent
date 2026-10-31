import type { Trace } from "@/lib/api";
import run from "@/content/eval-run.json";
import changelogFile from "@/content/changelog.json";
import runsFile from "@/content/runs.json";
import tracesFile from "@/content/traces.json";

export type Result = {
  case: {
    id: string;
    suite: string;
    merchant_id: number;
    question: string;
    value_kind?: string;
    gold_sql?: string;
    note?: string;
  };
  gold: unknown;
  grade: { outcome: string; reasons: string[]; expected: unknown; found: unknown };
  trace: Trace;
};

export type Run = {
  summary: {
    ran_at: string;
    model: string;
    effort: string;
    retrieval_threshold: number;
    commit: string | null;
    dataset: string;
    frozen_now: string;
    ground_truth: string;
    cases: number;
    scored: number;
    passed: number;
    errors: number;
    suites: Record<string, { passed: number; total: number }>;
    cost_total_usd: number;
    cost_per_answered_median_usd: number | null;
    cost_per_answered_p90_usd: number | null;
    latency_median_ms: number | null;
    latency_p90_ms: number | null;
    retrieval: { precision: number | null; recall: number | null; sections_shown: number; sections_expected: number };
  };
  results: Result[];
};

export const data = run as unknown as Run;

export type Entry = {
  run: string;
  date: string;
  title: string;
  changed: string[];
  result: string;
  conclusion: string;
};
export const changelog = changelogFile as Entry[];

export type RunRecord = {
  run: string;
  date: string;
  retrieval_threshold: number;
  model: string;
  passed: number;
  scored: number;
  outcomes: Record<
    string,
    {
      outcome: string;
      status: string;
      reasons: string[];
      expected: unknown;
      found: unknown;
      cost_usd: number;
      latency_ms: number;
    }
  >;
};
const RUN1 = "20261030T025434Z";
const RUN2 = "20261031T035921Z";
export const runs = runsFile as RunRecord[];
const traces = tracesFile as Record<string, Record<string, Trace>>;

// One case as each run saw it: the grade, the trace, and the model's last query.
export type RunView = {
  run: string;
  label: string;
  outcome: string;
  reasons: string[];
  trace: Trace;
  modelSql: string | null;
  diagnosis?: string[];
};

export function runViews(id: string): RunView[] {
  return runs.flatMap((r, i) => {
    const trace = traces[r.run]?.[id];
    const o = r.outcomes[id];

    if (!trace || !o) return [];

    return [{ run: r.run, label: `Run ${i + 1}`, outcome: o.outcome, reasons: o.reasons, trace, modelSql: modelQuery(trace), diagnosis: diagnosis[id]?.[r.run] }];
  });
}

export const suiteTitle: Record<string, string> = {
  sql: "SQL: the figure, on questions where a word needs a definition",
  policy: "Policy: cites the right section, none from the other restaurant",
  refuse: "Refusals: questions it must decline",
  tenant: "Tenancy: asking about the other restaurant",
  answer: "Plain questions: answered without a policy search",
  propose: "Proposals: checked by code before a person sees them",
};

// What the author found when reading each run's trace, keyed by case and run,
// so the text changes with the run a reader has picked. One point per line.
export const diagnosis: Record<string, Record<string, string[]>> = {
  "sql-05": {
    [RUN1]: [
      "The first query converted every order's timestamp to the restaurant's time zone and looked up the card fee with a subquery per order. It timed out.",
      "The rewrite converted the two month boundaries instead, which is the faster shape, but wrote the literal as a timestamptz and pushed it through AT TIME ZONE the wrong way.",
      "The window came out ten hours early at both ends: 2,643 in-store orders instead of 2,633, 1,271 DoorDash instead of 1,269, and $2.49 instead of $2.64.",
      "The guard passed it, as it should. Nothing in the guard knows what September means.",
    ],
    [RUN2]: [
      "The same slip from a different start. The first query timed out on a per-order fee subquery again.",
      "The rewrite again put the month boundaries through AT TIME ZONE in the wrong direction, ten hours early at both ends, with the same 2,643 and 1,271 orders and the same $2.49.",
      "This time the model wrote a caveat that the boundaries may be off by a few hours and that it did not expect the averages to move much. Right about the cause, wrong about the size: 6%, and the tolerance is 3%.",
    ],
  },
  "pol-02": {
    [RUN1]: [
      "The section that says Ridgeline is on no marketplace scored 0.28 against the model's second search, far under the 0.50 threshold. A question about DoorDash dispute deadlines does not read like a sentence saying there are no marketplaces.",
      "Shown nothing by either search, the model said the policies do not cover it and pointed at the DoorDash portal.",
      "That is the wrong advice for a restaurant that is not on DoorDash.",
    ],
    [RUN2]: [
      "The lower threshold did not reach it. The right section scored 0.30 and stayed hidden.",
      "What the 0.40 line let through was House Policy §5, Online Orders, at 0.41. The model cited it to say it covers Square Online pickup and does not apply to DoorDash. Honest reading of the wrong section.",
      "The answer still says there is no deadline, and the owner still has no way to see that the real rule is one sentence away.",
    ],
  },
  "pol-03": {
    [RUN1]: [
      "Passed. Quiet Hours scored 0.67 and was shown with three neighbours.",
      "The answer said no texts between 8pm and 9am, and all three citations carried the full document name, so the citations step passed them.",
    ],
    [RUN2]: [
      "The same answer, and a formatting slip. The model cited Quiet Hours and the audience section with their full labels, then shortened the next two to [§4, Frequency] and [§5, Offers in Messages].",
      "The citations step accepts labels exactly as retrieved and failed them.",
      "The answer itself is right: no texts between 8pm and 9am.",
    ],
  },
  "pol-05": {
    [RUN1]: [
      "Passed. The best match for health inspections was the Allergies section at 0.41, under the 0.50 line.",
      "The model was shown nothing, said the policies do not cover it, and cited nothing.",
    ],
    [RUN2]: [
      "At 0.40 the Allergies section, still at 0.41, was shown.",
      "The model still said the policies do not cover health inspections, and it cited the section to say so.",
      "My grader's rule for a not-covered case is that nothing is shown and nothing is cited, so this counts as a fail. The answer is right.",
      "The grade is the price of the lower threshold, and the rule is mine to reconsider.",
    ],
  },
  "pol-11": {
    [RUN1]: [
      "The answer was right and the campaign was blocked, as it should be.",
      "The model wrote the first two labels in full, then shortened the next three to [§3, Quiet Hours], [§5] and [§6, Required Wording].",
      "The citations step only accepts labels exactly as retrieved and failed them. A formatting slip caught by code.",
    ],
    [RUN2]: [
      "Right answer again, campaign blocked again.",
      "One short label this time instead of three: [§6, Required Wording] after three full ones. The same check failed it for the same reason.",
    ],
  },
  "pol-12": {
    [RUN1]: [
      "Across four searches the Discounts section scored 0.47 and 0.49, under the 0.50 line both times, so the model never saw it.",
      "It cited Catering alone and said the policies do not say whether a lead can approve 25% off.",
    ],
    [RUN2]: [
      "Passed. At 0.40 the Discounts section came through at 0.43 on the first search.",
      "The model answered no, a discount over 20% needs the owner, and cited Discounts and Catering with full labels.",
    ],
  },
};

// One line naming the failure in plain words, shown as the card's heading.
export const headline: Record<string, string> = {
  "sql-05": "A query that runs clean, looks right, and returns the wrong number",
  "pol-02": "The rule exists, the search never shows it, and the agent says there is no rule",
  "pol-11": "A right answer with a sloppy citation, caught by code",
  "pol-03": "The same sloppy citation, on a different question",
  "pol-05": "A question the policies do not cover, and a section shown anyway",
};

export function modelQuery(trace: Trace): string | null {
  const runs = trace.steps.filter((s) => s.name === "run_sql" && typeof s.detail?.sql === "string");
  const last = runs[runs.length - 1];

  return last ? String(last.detail!.sql) : null;
}

export const errors = data.results.filter((r) => r.grade.outcome === "error");

export function suite(name: string): Result[] {
  return data.results.filter((r) => r.case.suite === name);
}

export function failed(results: Result[]): Result[] {
  return results.filter((r) => r.grade.outcome === "fail");
}

export function describeExpectation(c: Result["case"] & Record<string, unknown>): string {
  switch (c.suite) {
    case "sql":
      return "Answered, and the answer contains the figure from the query I wrote.";
    case "policy":
      return c.retrieval_empty
        ? "Answered without citing anything, because no section of this restaurant's policies applies."
        : `Answered, citing ${(c.expected_citations as string[] | undefined)?.join(", ") ?? "the right section"}.`;
    case "refuse":
      return "Declined or blocked, without any query reaching the database.";
    case "tenant":
      return "Answered or declined. Every query is limited to this restaurant and the other restaurant's figures do not appear.";
    case "answer":
      return "Answered plainly, without searching the policies.";
    case "propose":
      return c.proposal_status === "pending"
        ? `A ${String(c.proposal_kind).replace("_", " ")} proposal left pending for a person.`
        : `No ${String(c.proposal_kind).replace("_", " ")} proposal left pending: either not proposed, or blocked by code.`;
    default:
      return "";
  }
}

