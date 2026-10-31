"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";

// A block held to a fixed height until the reader asks for the rest. The
// button only appears when something is hidden, and on hover so the two
// query blocks stay quiet side by side.
export function Clamped({ children, label }: { children: React.ReactNode; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [overflows, setOverflows] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const el = ref.current;

    if (!el) return;
    setOverflows(el.scrollHeight > el.clientHeight + 1);
  }, [children]);

  const clamped = overflows && !open;

  return (
    <div className="group relative">
      <div ref={ref} className={open ? undefined : "max-h-[28rem] overflow-hidden"}>
        {children}
      </div>
      {clamped && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 rounded-b-md bg-gradient-to-t from-background to-transparent" />
      )}
      {overflows && (
        <div className="absolute inset-x-0 bottom-3 flex justify-center opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 max-md:opacity-100">
          <Button size="sm" variant="outline" className="font-heading" onClick={() => setOpen(!open)}>
            {open ? <ChevronUp className="size-4" aria-hidden /> : <ChevronDown className="size-4" aria-hidden />}
            {open ? `Show less of ${label}` : `Show all of ${label}`}
          </Button>
        </div>
      )}
    </div>
  );
}
