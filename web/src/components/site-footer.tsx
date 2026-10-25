import Link from "next/link";
import { FooterNav } from "@/components/nav-links";
import { GitHubLink } from "@/components/github-link";
import { ThemeToggle } from "@/components/theme";

export function SiteFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-5xl flex-col gap-10 px-8 py-16 sm:flex-row sm:justify-between sm:px-16 sm:py-20">
        <div className="max-w-md">
          <Link href="/" className="font-heading text-lg font-semibold">
            Restaurant ops agent
          </Link>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            An applied AI case study by Rost M. Two fictional restaurants with generated orders.
            No real sales data.
          </p>
          <div className="mt-5 flex items-center gap-2">
            <GitHubLink />
            <ThemeToggle />
          </div>
        </div>
        <nav aria-label="Pages">
          <FooterNav />
        </nav>
      </div>
    </footer>
  );
}
