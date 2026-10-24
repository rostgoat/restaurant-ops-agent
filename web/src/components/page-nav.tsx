"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";

const order = [
  { href: "/", label: "Home" },
  { href: "/scenarios", label: "Scenarios" },
  { href: "/architecture", label: "Architecture" },
  { href: "/ask", label: "Ask" },
];

export function PageNav() {
  const pathname = usePathname();
  const index = order.findIndex((p) => p.href === pathname);
  if (index === -1) return null;
  const previous = order[index - 1];
  const next = order[index + 1];
  return (
    <nav aria-label="Pages" className="mx-auto flex w-full max-w-5xl justify-between gap-4 px-8 pb-20 sm:px-16">
      <div>
        {previous && (
          <Button asChild variant="outline" size="lg" className="h-11 px-5 font-heading text-base">
            <Link href={previous.href}>Previous: {previous.label}</Link>
          </Button>
        )}
      </div>
      <div>
        {next && (
          <Button asChild size="lg" className="h-11 px-5 font-heading text-base">
            <Link href={next.href}>Next: {next.label}</Link>
          </Button>
        )}
      </div>
    </nav>
  );
}
