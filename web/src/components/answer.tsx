"use client";

import { useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import policies from "@/content/policies.json";
import { cn } from "@/lib/utils";

type Section = { document: string; number: number; section: string; body: string };
type Policies = Record<string, Record<string, Section>>;
const all = policies as Policies;

const CITATION = /\[([^[\]]*§\s*\d+[^[\]]*)\]/g;

function section(merchantId: number, label: string): Section | null {
  return all[String(merchantId)]?.[label.replace(/\s+/g, " ").trim()] ?? null;
}

const prose =
  "space-y-3 leading-relaxed [&_li]:ml-5 [&_ol]:list-decimal [&_table]:w-full [&_td]:border-t [&_td]:py-1 [&_td]:pr-3 [&_th]:py-1 [&_th]:pr-3 [&_th]:text-left [&_th]:font-normal [&_th]:text-muted-foreground [&_ul]:list-disc";

export function Answer({
  text,
  merchantId,
  className,
}: {
  text: string;
  merchantId: number;
  className?: string;
}) {
  const [open, setOpen] = useState<string | null>(null);
  // "[A §1, X; B §2, Y]" cites two sections in one bracket.
  const linked = text.replace(CITATION, (whole, inside: string) => {
    const labels = inside.split(";").map((l) => l.trim()).filter(Boolean);
    if (!labels.every((l) => section(merchantId, l))) return whole;
    return labels.map((l) => `[${l}](#policy/${encodeURIComponent(l)})`).join(" ");
  });
  const current = open ? section(merchantId, open) : null;
  return (
    <>
      <div className={cn(prose, className)}>
        <Markdown
          remarkPlugins={[remarkGfm]}
          components={{
            a: ({ href, children }) => {
              const m = href?.match(/^#policy\/(.+)$/);
              if (!m) return <a href={href}>{children}</a>;
              const label = decodeURIComponent(m[1]);
              return (
                <button
                  type="button"
                  onClick={() => setOpen(label)}
                  className="rounded-sm bg-primary/10 px-1 font-heading text-[0.9em] text-primary underline-offset-4 hover:underline"
                >
                  {children}
                </button>
              );
            },
          }}
        >
          {linked}
        </Markdown>
      </div>
      <Dialog open={open !== null} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl">
              {current ? `§${current.number}. ${current.section}` : open}
            </DialogTitle>
            <DialogDescription>
              From this restaurant&apos;s {current?.document ?? "policy"}, as the agent retrieved
              it.
            </DialogDescription>
          </DialogHeader>
          <div className={cn(prose, "text-base")}>
            <Markdown remarkPlugins={[remarkGfm]}>{current?.body ?? ""}</Markdown>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
