"use client";

import { useTransition } from "react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Merchant } from "@/lib/api";
import { switchMerchant } from "@/app/actions";

export function MerchantPicker({ merchants, current }: { merchants: Merchant[]; current: number }) {
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex items-center gap-2">
      <Label htmlFor="merchant" className="text-sm text-muted-foreground">
        Viewing as
      </Label>
      <Select
        defaultValue={String(current)}
        disabled={pending}
        onValueChange={(value) => startTransition(() => switchMerchant(Number(value)))}
      >
        <SelectTrigger id="merchant" className="bg-card font-heading">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {merchants.map((m) => (
            <SelectItem key={m.id} value={String(m.id)} className="font-heading">
              {m.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
