import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const look: Record<number, { name: string; emoji: string; className: string }> = {
  1: {
    name: "Mekong Noodle House",
    emoji: "🍜",
    className: "border-amber-500/30 bg-amber-500/15 text-amber-800 dark:text-amber-300",
  },
  2: {
    name: "Ridgeline Coffee",
    emoji: "☕",
    className: "border-fuchsia-500/30 bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300",
  },
};

export function MerchantBadge({ merchantId, className }: { merchantId: number; className?: string }) {
  const m = look[merchantId] ?? { name: `Merchant ${merchantId}`, emoji: "🏪", className: "" };

  return (
    <Badge variant="outline" className={cn("font-heading text-sm", m.className, className)}>
      <span aria-hidden>{m.emoji}</span> {m.name}
    </Badge>
  );
}
