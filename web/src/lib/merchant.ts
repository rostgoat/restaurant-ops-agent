import "server-only";
import { cookies } from "next/headers";

const COOKIE = "merchant";
const DEFAULT_MERCHANT = 1;

export async function currentMerchant(): Promise<number> {
  const value = (await cookies()).get(COOKIE)?.value;
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : DEFAULT_MERCHANT;
}

export async function setCurrentMerchant(id: number): Promise<void> {
  (await cookies()).set(COOKIE, String(id), { path: "/", sameSite: "lax" });
}
