export function Kicker({ page }: { page?: string }) {
  return (
    <p className="font-heading text-base text-primary">
      Applied AI case study{page ? ` – ${page}` : ""}
    </p>
  );
}
