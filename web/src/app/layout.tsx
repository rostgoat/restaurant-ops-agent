import type { Metadata } from "next";
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
              <li aria-hidden className="mx-1 h-5 w-px bg-border" />
              <li className="-mr-1">
                <GitHubLink variant="ghost" />
              </li>
              <li>
                <ThemeToggle />
              </li>
            </ul>
          </nav>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-8 py-20 sm:px-16 sm:py-28">{children}</main>
        <PageNav />
        <BackToTop />
        <SiteFooter />
        </ThemeProvider>
      </body>
    </html>
  );
}
