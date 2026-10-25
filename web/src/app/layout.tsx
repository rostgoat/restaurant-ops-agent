import { Analytics } from "@vercel/analytics/next";
import type { Metadata } from "next";
import type React from "react";
import { Bricolage_Grotesque, Inter } from "next/font/google";
import Link from "next/link";
import { BackToTop } from "@/components/back-to-top";
import { GitHubLink } from "@/components/github-link";
import { NavLinks } from "@/components/nav-links";
import { PageNav } from "@/components/page-nav";
import { SiteFooter } from "@/components/site-footer";
import { ThemeProvider, ThemeToggle } from "@/components/theme";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";
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
  metadataBase: SITE_URL,
  title: { default: SITE_NAME, template: `%s · ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    url: "/",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: SITE_NAME }],
  },
  twitter: { card: "summary_large_image", title: SITE_NAME, description: SITE_DESCRIPTION },
  robots: { index: true, follow: true },
  alternates: { canonical: "/" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={cn("h-full", bricolage.variable, inter.variable)}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
        <header className="border-b">
          <nav className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-8 gap-y-3 px-5 py-5 sm:px-16 sm:py-6">
            <Link href="/" className="font-heading text-lg font-semibold">
              Restaurant ops agent
            </Link>
            {/* On a phone the icons share the title's row and the links take the next one. */}
            <div className="flex items-center sm:order-3">
              <span aria-hidden className="mx-2 hidden h-5 w-px bg-border sm:block" />
              <GitHubLink variant="ghost" />
              <ThemeToggle />
            </div>
            <ul className="flex w-full flex-wrap items-center gap-x-2 sm:order-2 sm:w-auto sm:gap-x-4">
              <NavLinks />
            </ul>
          </nav>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-14 sm:px-16 sm:py-28">{children}</main>
        <PageNav />
        <BackToTop />
        <SiteFooter />
        <Analytics />
        </ThemeProvider>
      </body>
    </html>
  );
}
