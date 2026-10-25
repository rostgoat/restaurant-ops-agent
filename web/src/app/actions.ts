"use server";

import { ApiUnreachable, ask, questionStats, type QuestionStats, type Trace } from "@/lib/api";
import { scenarios } from "@/lib/scenarios";

export type RerunState = { trace?: Trace; stats?: QuestionStats | null; error?: string };

// Asks a scenario's question again, live, as the same restaurant. The
// question and the restaurant come from the captured scenario, never from
// the browser, so the only thing a visitor can spend is one of five known
// questions.
export async function rerunScenario(slug: string): Promise<RerunState> {
  const scenario = scenarios.find((s) => s.slug === slug);

  if (!scenario) return { error: "No such scenario." };

  try {
    const trace = await ask(scenario.merchant_id, scenario.question);

    return { trace, stats: await questionStats(scenario.merchant_id, scenario.question) };
  } catch (e) {
    if (e instanceof ApiUnreachable) return { error: "The agent is not running right now." };

    return { error: "The question could not be sent. Try again." };
  }
}
