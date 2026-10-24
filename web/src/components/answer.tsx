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

type Policies = Record<string, Record<string, { title: string; sections: Record<string, string> }>>;
const all = policies as Policies;

const CITATION = /\[([a-z-]+): ([^\]]+)\]/g;

function section(merchantId: number, document: string, name: string) {
  const doc = all[String(merchantId)]?.[document];
  const body = doc?.sections[name];
  return body ? { title: doc.title, body } : null;
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
  const [open, setOpen] = useState<{ document: string; name: string } | null>(null);
  const linked = text.replace(CITATION, (whole, document, name) =>
    section(merchantId, document, name)
      ? `[${document}: ${name}](#policy/${encodeURIComponent(document)}/${encodeURIComponent(name)})`
      : whole
  );
  const current = open ? section(merchantId, open.document, open.name) : null;
  return (
    <>
      <div className={cn(prose, className)}>
        <Markdown
          remarkPlugins={[remarkGfm]}
          components={{
            a: ({ href, children }) => {
              const m = href?.match(/^#policy\/([^/]+)\/(.+)$/);
              if (!m) return <a href={href}>{children}</a>;
              const document = decodeURIComponent(m[1]);
              const name = decodeURIComponent(m[2]);
              return (
                <button
                  type="button"
                  onClick={() => setOpen({ document, name })}
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
            <DialogTitle className="font-heading text-xl">{open?.name}</DialogTitle>
            <DialogDescription>
              From {current?.title ?? open?.document}, this restaurant&apos;s own policy, as the
              agent retrieved it.
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
