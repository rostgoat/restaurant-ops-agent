import "server-only";
import type { components } from "./api-types";

export type Trace = components["schemas"]["TraceOut"];
export type Step = components["schemas"]["StepOut"];

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
