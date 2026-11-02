import { Badge } from "@/components/ui/badge";

export function OutcomeBadge({ outcome, compact = false }: { outcome: string; compact?: boolean }) {
  const tone =
    outcome === "pass"
      ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
      : outcome === "fail"
        ? "border-rose-500/30 bg-rose-500/15 text-rose-700 dark:text-rose-300"
        : "border-amber-500/30 bg-amber-500/15 text-amber-800 dark:text-amber-300";

  if (compact) {
    const dot = outcome === "pass" ? "bg-emerald-500" : outcome === "fail" ? "bg-rose-500" : "bg-amber-500";

    return <span role="img" aria-label={outcome} title={outcome} className={`inline-block size-3 rounded-full ${dot}`} />;
  }

  return (
    <Badge variant="outline" className={`font-heading ${tone}`}>
      {outcome}
    </Badge>
  );
}
