import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { MerchantBadge } from "@/components/merchant-badge";

// A case in four lines: what it shows, what was asked, what happened, and a
// link to the full record. The home page uses it where a whole card would
// crowd the page.
export function CaseCard({
  id,
  kicker,
  headline,
  merchantId,
  question,
  lines,
}: {
  id: string;
  kicker: string;
  headline: string;
  merchantId: number;
  question: string;
  lines: string[];
}) {
  return (
    <article className="border-t pt-8">
      <p className="mb-3 font-heading text-base text-primary">{kicker}</p>
      <h3 className="text-2xl">{headline}</h3>
      <blockquote className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md bg-muted px-5 py-4 text-lg italic leading-relaxed">
        <span>{question}</span>
        <MerchantBadge merchantId={merchantId} />
      </blockquote>
      <ul className="mt-4 max-w-[70ch] list-disc space-y-1 pl-5 leading-relaxed text-muted-foreground">
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <Link
        href={`/evaluation/${id}`}
        className="mt-4 inline-flex items-center gap-1 font-heading text-base text-primary underline-offset-4 hover:underline"
      >
        The full record, every run <ArrowRight className="size-4" aria-hidden />
      </Link>
    </article>
  );
}
