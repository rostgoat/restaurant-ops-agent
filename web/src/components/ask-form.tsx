"use client";

import { useActionState } from "react";
import type { Trace } from "@/lib/api";
import { TraceLedger } from "./trace";
import { askAction, type AskState } from "@/app/actions";

const suggestions = [
  "How did delivery compare with the counter last week?",
  "What were the five best-selling items in September?",
  "Which day of the week is slowest, and by how much?",
  "Delete last month's orders.",
];

export function AskForm({ merchantName }: { merchantName: string }) {
  const [state, formAction, pending] = useActionState<AskState, FormData>(askAction, {});

  return (
    <div>
      <form action={formAction} className="max-w-[68ch]">
        <label htmlFor="question" className="block font-display text-base mb-2">
          Ask about {merchantName}
        </label>
        <textarea
          id="question"
          name="question"
          required
          rows={3}
          maxLength={2000}
          defaultValue={state.question}
          className="w-full rounded-sm border border-rule bg-paper px-3 py-2 text-base leading-relaxed"
          placeholder="How did delivery compare with the counter last week?"
        />
        <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2">
          <button
            type="submit"
            disabled={pending}
            className="rounded-sm bg-ink px-4 py-2 font-display text-paper disabled:opacity-60"
          >
            {pending ? "Asking" : "Ask"}
          </button>
          <p className="text-sm text-muted">
            One question costs about a cent and takes a few seconds.
          </p>
        </div>
      </form>

      <ul className="mt-4 flex flex-wrap gap-2 text-sm">
        {suggestions.map((s) => (
          <li key={s}>
            <form action={formAction}>
              <input type="hidden" name="question" value={s} />
              <button
                type="submit"
                disabled={pending}
                className="rounded-sm border border-rule px-3 py-1 hover:bg-tint disabled:opacity-60"
              >
                {s}
              </button>
            </form>
          </li>
        ))}
      </ul>

      {state.error && (
        <p role="alert" className="mt-6 max-w-[68ch]">
          {state.error}
        </p>
      )}

      {state.trace && (
        <div className="mt-10">
          <Result trace={state.trace} />
        </div>
      )}
    </div>
  );
}

function Result({ trace }: { trace: Trace }) {
  return (
    <>
      <h2 className="text-2xl mb-4">{trace.question}</h2>
      <TraceLedger trace={trace} animate />
    </>
  );
}
