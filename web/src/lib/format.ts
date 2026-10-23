export function dollars(usd: number): string {
  return `$${usd.toFixed(4)}`;
}

export function seconds(ms: number): string {
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;
}

export function count(n: number): string {
  return n.toLocaleString("en-US");
}

export function cents(c: number): string {
  return (c / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}
