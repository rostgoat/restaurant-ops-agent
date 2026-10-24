"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export function ScenarioToc({ items }: { items: { slug: string; title: string }[] }) {
  const [active, setActive] = useState(items[0]?.slug);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-20% 0px -65% 0px", threshold: 0 }
    );
    for (const item of items) {
      const el = document.getElementById(item.slug);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [items]);

  return (
    <nav aria-label="Scenarios on this page" className="sticky top-10 hidden lg:block">
      <p className="mb-3 font-heading text-sm text-muted-foreground">On this page</p>
      <ol className="space-y-1 border-l">
        {items.map((item, i) => (
          <li key={item.slug}>
            <a
              href={`#${item.slug}`}
              className={cn(
                "-ml-px block border-l-2 py-1 pl-4 text-sm leading-snug transition-colors",
                active === item.slug
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <span className="font-sql text-xs text-muted-foreground">{i + 1}</span> {item.title}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
