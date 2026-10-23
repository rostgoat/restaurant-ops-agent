import type { Metadata } from "next";
import { Bricolage_Grotesque, Source_Serif_4 } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  weight: ["500", "600"],
});

const sourceSerif = Source_Serif_4({
  variable: "--font-source-serif",
  subsets: ["latin"],
  weight: ["400", "600"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "Restaurant ops agent",
  description:
    "An agent that answers a restaurant owner's questions about their sales, with every step traced and checked.",
};

const pages = [
  { href: "/", label: "Ask" },
  { href: "/architecture", label: "Architecture" },
];

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${bricolage.variable} ${sourceSerif.variable} h-full`}>
      <body className="min-h-full flex flex-col">
        <header className="border-b border-rule">
          <nav className="mx-auto flex max-w-[1120px] flex-wrap items-baseline justify-between gap-x-6 gap-y-2 px-6 py-4">
            <Link href="/" className="font-display text-lg font-semibold">
              Restaurant ops agent
            </Link>
            <ul className="flex gap-6 font-display text-base">
              {pages.map((p) => (
                <li key={p.href}>
                  <Link href={p.href} className="hover:underline underline-offset-4">
                    {p.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </header>
        <main className="mx-auto w-full max-w-[1120px] flex-1 px-6 py-10">{children}</main>
        <footer className="border-t border-rule">
          <p className="mx-auto max-w-[1120px] px-6 py-6 text-sm text-muted">
            Synthetic data for two fictional restaurants. Nothing here is real sales.
          </p>
        </footer>
      </body>
    </html>
  );
}
