import type { Trace } from "./api";

export type Scenario = {
  slug: string;
  title: string;
  merchant_id: number;
  question: string;
  expected: string;
  trace: Trace;
};

export const merchantName: Record<number, string> = {
  1: "Mekong Noodle House",
  2: "Ridgeline Coffee",
};
