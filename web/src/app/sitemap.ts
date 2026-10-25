import type { MetadataRoute } from "next";
import { data } from "@/lib/evaluation";
import { SITE_URL } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const at = (path: string) => new URL(path, SITE_URL).toString();
  const ran = new Date(data.summary.ran_at);
  const pages: MetadataRoute.Sitemap = [
    { url: at("/"), lastModified: ran, changeFrequency: "weekly", priority: 1 },
    { url: at("/scenarios"), lastModified: ran, changeFrequency: "weekly", priority: 0.9 },
    { url: at("/evaluation"), lastModified: ran, changeFrequency: "weekly", priority: 0.9 },
    { url: at("/architecture"), lastModified: ran, changeFrequency: "monthly", priority: 0.8 },
  ];
  const cases: MetadataRoute.Sitemap = data.results.map((r) => ({
    url: at(`/evaluation/${r.case.id}`),
    lastModified: ran,
    changeFrequency: "monthly",
    priority: 0.5,
  }));

  return [...pages, ...cases];
}
