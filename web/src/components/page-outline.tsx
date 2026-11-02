"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export type OutlineItem = { slug: string; title: string; children?: { slug: string; title: string }[] };

export function PageOutline({ items }: { items: OutlineItem[] }) {
  const [active, setActive] = useState(items[0]?.slug);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const line = window.innerHeight * 0.3;
      let current = items[0]?.slug;

      for (const item of items) {
        const el = document.getElementById(item.slug);

        if (el && el.getBoundingClientRect().top <= line) current = item.slug;
      }
      setActive(current);
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);

      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [items]);

  return (
    <nav
      aria-label="On this page"
      className="group fixed top-1/2 right-0 z-20 hidden -translate-y-1/2 lg:block"
    >
      <ol className="flex flex-col items-end gap-2 py-3 pr-4 pl-6">
        {items.map((item) => (
          <li key={item.slug}>
            <a href={`#${item.slug}`} aria-label={item.title} className="block py-1">
              <span
                className={cn(
                  "block h-0.5 rounded-full transition-all",
                  active === item.slug ? "w-6 bg-foreground" : "w-4 bg-muted-foreground/50"
                )}
              />
            </a>
          </li>
        ))}
      </ol>
      <div className="pointer-events-none absolute top-1/2 right-0 w-72 -translate-y-1/2 translate-x-4 rounded-l-lg border border-r-0 bg-card p-4 opacity-0 shadow-lg transition-all duration-200 group-hover:pointer-events-auto group-hover:translate-x-0 group-hover:opacity-100">
        <p className="mb-2 font-heading text-sm text-muted-foreground">On this page</p>
        <ol className="space-y-0.5">
          {items.map((item, i) => (
            <li key={item.slug}>
              <a
                href={`#${item.slug}`}
                className={cn(
                  "block rounded-sm px-2 py-1 text-sm leading-snug hover:bg-muted",
                  active === item.slug ? "text-foreground" : "text-muted-foreground"
                )}
              >
                <span className="font-sql text-xs text-muted-foreground">{i + 1}</span> {item.title}
              </a>
              {item.children && (
                <ol className="mb-1 ml-5 space-y-0.5 border-l pl-2">
                  {item.children.map((child) => (
                    <li key={child.slug}>
                      <a
                        href={`#${child.slug}`}
                        className="block rounded-sm px-2 py-0.5 text-xs leading-snug text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        <span className="font-sql">{child.slug}</span> {child.title}
                      </a>
                    </li>
                  ))}
                </ol>
              )}
            </li>
          ))}
        </ol>
      </div>
    </nav>
  );
}
