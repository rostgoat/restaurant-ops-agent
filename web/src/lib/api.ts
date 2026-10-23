import "server-only";
import { cacheLife } from "next/cache";
import type { components } from "./api-types";

export type Trace = components["schemas"]["TraceOut"];
export type Step = components["schemas"]["StepOut"];
export type Merchant = components["schemas"]["MerchantOut"];

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

function asMerchant(merchantId: number): HeadersInit {
  return { "X-Merchant-Id": String(merchantId) };
}

export async function getMerchants(): Promise<Merchant[]> {
  "use cache";
  cacheLife("hours");
  return call<Merchant[]>("/merchants");
}

export async function getRecentTraces(merchantId: number, limit = 10): Promise<Trace[]> {
  return call<Trace[]>(`/traces?limit=${limit}`, { headers: asMerchant(merchantId) });
}

export async function getTrace(id: string, merchantId: number): Promise<Trace | null> {
  try {
    return await call<Trace>(`/traces/${id}`, { headers: asMerchant(merchantId) });
  } catch (e) {
    if (e instanceof Error && e.message.endsWith("404")) return null;
    throw e;
  }
}

export async function ask(merchantId: number, question: string): Promise<Trace> {
  return call<Trace>("/ask", {
    method: "POST",
    headers: { ...asMerchant(merchantId), "content-type": "application/json" },
    body: JSON.stringify({ question }),
  });
}
