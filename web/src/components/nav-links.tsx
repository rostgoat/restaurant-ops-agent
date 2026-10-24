"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const pages = [
  { href: "/scenarios", label: "Scenarios" },
  { href: "/evaluation", label: "Evaluation" },
  { href: "/architecture", label: "Architecture" },
  { href: "/ask", label: "Ask" },
];

export function currentPage(pathname: string) {
  return pages.find((p) => pathname === p.href || pathname.startsWith(`${p.href}/`));
}

export function NavLinks() {
  const pathname = usePathname();
  const current = currentPage(pathname);
  return (
    <>
      {pages.map((p) => {
        const active = current?.href === p.href;
        return (
          <li key={p.href}>
            <Button
              asChild
              variant="link"
              className={cn(
                "font-heading text-base text-foreground",
                active && "text-primary underline underline-offset-8 decoration-2",
              )}
            >
              <Link href={p.href} aria-current={active ? "page" : undefined}>
                {p.label}
              </Link>
            </Button>
          </li>
        );
      })}
    </>
  );
}
