import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="">
      <h1 className="mb-3 text-3xl">There is nothing at this address</h1>
      <p className="mb-4">The case may not exist, or the link is wrong.</p>
      <Button asChild>
        <Link href="/evaluation">See the evaluation</Link>
      </Button>
    </div>
  );
}
