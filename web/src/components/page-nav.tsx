"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const order = [
  { href: "/", label: "Home", blurb: "The case study in one page." },
  {
    href: "/scenarios",
    label: "Scenarios",
    blurb: "Ten questions, with the expected behaviour written down first.",
  },
  {
    href: "/architecture",
    label: "Architecture",
    blurb: "How a question becomes an answer, and what stops it.",
  },
  { href: "/ask", label: "Ask", blurb: "Put your own question to either restaurant." },
];

export function PageNav() {
  const pathname = usePathname();
  const index = order.findIndex((p) => p.href === pathname);
  if (index === -1) return null;
  const previous = order[index - 1];
  const next = order[index + 1];
  return (
    <nav aria-label="Pages" className="mx-auto w-full max-w-5xl px-8 pb-20 sm:px-16">
      <div className="rounded-lg border p-6 sm:p-8">
        <p className="mb-6 font-heading text-sm text-muted-foreground">Where next</p>
        <div className="grid gap-8 sm:grid-cols-2">
          <div>
            {previous && (
              <Link href={previous.href} className="group block">
                <span className="inline-flex items-center gap-2 font-heading text-lg text-primary group-hover:underline underline-offset-4">
                  <ArrowLeft className="size-5" aria-hidden />
                  {previous.label}
                </span>
                <span className="mt-1 block text-sm text-muted-foreground">{previous.blurb}</span>
              </Link>
            )}
          </div>
          <div className="sm:text-right">
            {next && (
              <Link href={next.href} className="group block">
                <span className="inline-flex items-center gap-2 font-heading text-lg text-primary group-hover:underline underline-offset-4">
                  {next.label}
                  <ArrowRight className="size-5" aria-hidden />
                </span>
                <span className="mt-1 block text-sm text-muted-foreground">{next.blurb}</span>
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
