import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="">
      <h1 className="mb-3 text-3xl">There is nothing at this address</h1>
      <p className="mb-4">The trace may belong to another restaurant, or the link is wrong.</p>
      <Button asChild>
        <Link href="/ask">Ask a question</Link>
      </Button>
    </div>
  );
}
