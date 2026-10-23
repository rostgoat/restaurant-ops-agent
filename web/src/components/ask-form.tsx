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
        <Label htmlFor="question" className="mb-3 font-heading text-base">
          Ask about {merchantName}
        </Label>
        <Textarea
          id="question"
          name="question"
          required
          rows={3}
          maxLength={2000}
          defaultValue={state.question}
          className="bg-card px-4 py-3 text-base leading-relaxed"
          placeholder="How did delivery compare with the counter last week?"
        />
        <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3">
          <Button type="submit" size="lg" disabled={pending} className="h-11 px-6 font-heading text-base">
            {pending ? "Asking" : "Ask"}
          </Button>
          <p className="text-sm text-muted-foreground">
            One question costs a few cents and takes ten seconds or so.
          </p>
        </div>
      </form>

      <ul className="mt-8 flex flex-wrap gap-3">
        {suggestions.map((s) => (
          <li key={s}>
            <form action={formAction}>
              <input type="hidden" name="question" value={s} />
              <Button
                type="submit"
                variant="outline"
                size="sm"
                disabled={pending}
                className="h-auto px-4 py-2 text-left font-sans text-sm whitespace-normal"
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
        <div className="mt-20">
          <h3 className="mb-6 text-3xl">{state.trace.question}</h3>
          <TraceLedger trace={state.trace} animate />
        </div>
      )}
    </div>
  );
}
