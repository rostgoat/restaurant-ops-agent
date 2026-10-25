import type { Metadata } from "next";

// The public address of the site, for canonical links, the sitemap and
// Open Graph. Set NEXT_PUBLIC_SITE_URL in the deployment; Vercel's own
// hostname is the fallback for previews.
const fromEnv = process.env.NEXT_PUBLIC_SITE_URL;
const fromVercel = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null;

export const SITE_URL = new URL(fromEnv ?? fromVercel ?? "http://localhost:3000");
export const SITE_NAME = "Restaurant ops agent";
export const SITE_DESCRIPTION =
  "An AI agent that answers a restaurant's questions from its own sales data and policies. " +
  "Code decides what runs, a person approves every action, and every step is traced, costed and evaluated.";

const OG_IMAGE = { url: "/opengraph-image", width: 1200, height: 630, alt: SITE_NAME };

// Title, description, canonical link and Open Graph tags for one page. A page
// that sets its own Open Graph block replaces the default one entirely, so
// the image has to be named here or nested pages lose it.
export function pageMetadata(title: string, description: string, path: string): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { title, description, url: path, images: [OG_IMAGE] },
    twitter: { card: "summary_large_image", title, description },
  };
}
