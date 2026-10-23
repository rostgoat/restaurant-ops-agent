"use server";

import { revalidatePath } from "next/cache";
import { ApiUnreachable, ask, type Trace } from "@/lib/api";
import { currentMerchant, setCurrentMerchant } from "@/lib/merchant";

export type AskState = {
  question?: string;
  trace?: Trace;
  error?: string;
};

export async function askAction(_prev: AskState, formData: FormData): Promise<AskState> {
  const question = String(formData.get("question") ?? "").trim();
  if (!question) return { error: "Type a question first." };
  const merchantId = await currentMerchant();
  try {
    const trace = await ask(merchantId, question);
    revalidatePath("/");
    return { question, trace };
  } catch (e) {
    if (e instanceof ApiUnreachable) {
      return { question, error: `${e.message} Start it with: cd api && .venv/bin/uvicorn app.main:app` };
    }
    return { question, error: "The question could not be sent. Try again." };
  }
}

export async function switchMerchant(id: number): Promise<void> {
  if (Number.isInteger(id) && id > 0) {
    await setCurrentMerchant(id);
    revalidatePath("/");
  }
}
