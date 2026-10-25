"use client";

import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function BackToTop() {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const onScroll = () => setShown(window.scrollY > 800);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <Button
      type="button"
      size="icon-lg"
      variant="outline"
      aria-label="Back to top"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className={cn(
        "fixed bottom-5 left-1/2 z-20 -translate-x-1/2 rounded-full shadow-lg transition-all duration-200 sm:right-6 sm:bottom-6 sm:left-auto sm:translate-x-0",
        shown ? "opacity-100" : "pointer-events-none opacity-0",
      )}
    >
      <ArrowUp className="size-5" aria-hidden />
    </Button>
  );
}
