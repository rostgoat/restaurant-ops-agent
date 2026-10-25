import type { Metadata } from "next";
import { Bricolage_Grotesque, Inter } from "next/font/google";
import Link from "next/link";
import { BackToTop } from "@/components/back-to-top";
import { NavLinks } from "@/components/nav-links";
import { PageNav } from "@/components/page-nav";
import { ThemeProvider, ThemeToggle } from "@/components/theme";
import { cn } from "@/lib/utils";
import "./globals.css";

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  weight: ["500", "600"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "Restaurant ops agent", template: "%s · Restaurant ops agent" },
  description:
    "An agent that answers a restaurant owner's questions about their sales, with every step traced and checked.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={cn("h-full", bricolage.variable, inter.variable)}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
        <header className="border-b">
          <nav className="mx-auto flex max-w-5xl flex-wrap items-baseline justify-between gap-x-8 gap-y-2 px-8 py-6 sm:px-16">
            <Link href="/" className="font-heading text-lg font-semibold">
              Restaurant ops agent
            </Link>
            <ul className="flex items-center gap-4">
              <NavLinks />
              <li>
                <ThemeToggle />
              </li>
            </ul>
          </nav>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-8 py-20 sm:px-16 sm:py-28">{children}</main>
        <PageNav />
        <BackToTop />
        <footer className="border-t">
          <p className="mx-auto max-w-5xl px-8 py-10 text-sm text-muted-foreground sm:px-16">
            Built by Rost M.{" "}
            <a
              href="https://github.com/rostgoat/restaurant-ops-agent"
              className="underline-offset-4 hover:underline"
            >
              GitHub
            </a>
            . Synthetic data for two fictional restaurants; nothing here is real sales.
          </p>
        </footer>
        </ThemeProvider>
      </body>
    </html>
  );
}
