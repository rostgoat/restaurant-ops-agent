import "server-only";
import type { components } from "./api-types";

export type Trace = components["schemas"]["TraceOut"];
export type Step = components["schemas"]["StepOut"];
export type QuestionStats = components["schemas"]["QuestionStatsOut"];

const API_URL = process.env.API_URL ?? "http://127.0.0.1:8000";

export class ApiUnreachable extends Error {
  constructor() {
    super(`The API at ${API_URL} did not answer.`);
  }
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, init);
  } catch {
    throw new ApiUnreachable();
  }
  if (!response.ok) {
    throw new Error(`${init.method ?? "GET"} ${path} returned ${response.status}`);
  }
  return (await response.json()) as T;
}

export async function ask(merchantId: number, question: string): Promise<Trace> {
  return call<Trace>("/ask", {
    method: "POST",
    headers: { "X-Merchant-Id": String(merchantId), "content-type": "application/json" },
    body: JSON.stringify({ question }),
  });
}

// How one question has fared every time this restaurant asked it, across
// the capture and every visitor's re-run. Null when the API is not up.
export async function questionStats(merchantId: number, question: string): Promise<QuestionStats | null> {
  try {
    return await call<QuestionStats>(`/questions/stats?question=${encodeURIComponent(question)}`, {
      headers: { "X-Merchant-Id": String(merchantId) },
      cache: "no-store",
    });
  } catch {
    return null;
  }
}
