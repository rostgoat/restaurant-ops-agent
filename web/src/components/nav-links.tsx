"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const pages = [
  { href: "/scenarios", label: "Scenarios" },
  { href: "/evaluation", label: "Evaluation" },
  { href: "/architecture", label: "Architecture" },
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

export function FooterNav() {
  const pathname = usePathname();
  const current = currentPage(pathname);

  return (
    <ul className="space-y-2">
      <li>
        <Link
          href="/"
          aria-current={pathname === "/" ? "page" : undefined}
          className={cn(
            "font-heading text-base underline-offset-4 hover:underline",
            pathname === "/" ? "text-primary" : "text-foreground",
          )}
        >
          Home
        </Link>
      </li>
      {pages.map((p) => (
        <li key={p.href}>
          <Link
            href={p.href}
            aria-current={current?.href === p.href ? "page" : undefined}
            className={cn(
              "font-heading text-base underline-offset-4 hover:underline",
              current?.href === p.href ? "text-primary" : "text-foreground",
            )}
          >
            {p.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}
