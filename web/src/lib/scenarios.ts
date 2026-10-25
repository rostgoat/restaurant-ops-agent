import deliveryVsCounter from "@/content/scenarios/delivery-vs-counter.json";
import injection from "@/content/scenarios/injection.json";
import repeatRefunder from "@/content/scenarios/repeat-refunder.json";
import textCampaign from "@/content/scenarios/text-campaign.json";
import fileDispute from "@/content/scenarios/file-dispute.json";

import type { Trace } from "./api";

export type Scenario = {
  slug: string;
  title: string;
  merchant_id: number;
  question: string;
  expected: string[];
  trace: Trace;
};

export const merchantName: Record<number, string> = {
  1: "Mekong Noodle House",
  2: "Ridgeline Coffee",
};

// In the order the Scenarios page shows them, simplest first.
export const scenarios = [
  deliveryVsCounter,
  injection,
  repeatRefunder,
  textCampaign,
  fileDispute,
] as unknown as Scenario[];
