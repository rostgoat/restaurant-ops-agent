import type { Merchant } from "@/lib/api";
import { switchMerchant } from "@/app/actions";

export function MerchantPicker({ merchants, current }: { merchants: Merchant[]; current: number }) {
  return (
    <form action={switchMerchant} className="flex items-baseline gap-2 text-sm">
      <label htmlFor="merchant" className="text-muted">
        Viewing as
      </label>
      <select
        id="merchant"
        name="merchant"
        defaultValue={current}
        className="rounded-sm border border-rule bg-paper px-2 py-1 font-display"
      >
        {merchants.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>
      <button type="submit" className="underline underline-offset-4">
        Switch
      </button>
    </form>
  );
}
