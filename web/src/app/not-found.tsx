import Link from "next/link";

export default function NotFound() {
  return (
    <div className="max-w-[68ch]">
      <h1 className="text-3xl mb-3">There is nothing at this address</h1>
      <p>
        The trace may belong to another restaurant, or the link is wrong.{" "}
        <Link href="/" className="underline underline-offset-4">
          Ask a question
        </Link>
        .
      </p>
    </div>
  );
}
