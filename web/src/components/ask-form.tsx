"use client";

import { useActionState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
        <Label htmlFor="question" className="mb-2 font-heading text-base">
          Ask about {merchantName}
        </Label>
        <Textarea
          id="question"
          name="question"
          required
          rows={3}
          maxLength={2000}
          defaultValue={state.question}
          className="text-base leading-relaxed"
          placeholder="How did delivery compare with the counter last week?"
        />
        <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2">
          <Button type="submit" size="lg" disabled={pending} className="font-heading text-base">
            {pending ? "Asking" : "Ask"}
          </Button>
          <p className="text-sm text-muted-foreground">
            One question costs about a cent and takes a few seconds.
          </p>
        </div>
      </form>

      <ul className="mt-4 flex flex-wrap gap-2">
        {suggestions.map((s) => (
          <li key={s}>
            <form action={formAction}>
              <input type="hidden" name="question" value={s} />
              <Button
                type="submit"
                variant="outline"
                size="sm"
                disabled={pending}
                className="h-auto py-1 text-left font-sans text-sm whitespace-normal"
              >
                {s}
              </Button>
            </form>
          </li>
        ))}
      </ul>

      {state.error && (
        <Alert variant="destructive" className="mt-6 max-w-[68ch]">
          <AlertTitle>The question was not sent</AlertTitle>
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      {state.trace && (
        <div className="mt-10">
          <h2 className="mb-4 text-2xl">{state.trace.question}</h2>
          <TraceLedger trace={state.trace} animate />
        </div>
      )}
    </div>
  );
}
