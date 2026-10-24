import Link from "next/link";
import { CapturedRun, capturedOn } from "@/components/captured-run";
import { Button } from "@/components/ui/button";
import type { Trace } from "@/lib/api";
import capturedAnswer from "@/content/captured-trace.json";
import capturedInjection from "@/content/captured-injection.json";

const evidence = [
  {
    figure: "8",
    label: "checks that run without the model before any query reaches the database",
    href: "/architecture",
  },
  {
    figure: "Next",
    label: "eval cases passing. The evaluation set is the next thing built; its numbers go here, good or bad",
    href: null,
  },
  {
    figure: "About 1¢",
    label: "per answered question on Claude Sonnet 5.5, measured from traced requests. Per merchant per month follows",
    href: null,
  },
];

const answered = capturedAnswer as Trace;
const refused = capturedInjection as Trace;

export default function HomePage() {
  return (
    <>
      <section className="max-w-[64ch]">
        <h1 className="max-w-[30ch] text-4xl sm:text-5xl">
          Letting a model write SQL against a restaurant&apos;s books, without letting it do
          harm.
        </h1>
        <p className="mt-8 text-lg leading-relaxed text-muted-foreground">
          A model can turn &ldquo;how did delivery do last week&rdquo; into a query on its own.
          Letting that query run against a real business is a different problem, and mostly not
          a prompting one. This project is where I worked through it. The model proposes, code
          decides what may run, a person approves anything that would change something, and every
          step is recorded and priced. The two restaurants are synthetic; the pipeline is not.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild size="lg" className="h-11 px-5 font-heading text-base">
            <Link href="/scenarios">See the scenarios</Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="h-11 px-5 font-heading text-base">
            <a href="https://github.com/rostgoat/restaurant-ops-agent">View the code</a>
          </Button>
        </div>
      </section>

      <section className="mt-16 grid max-w-4xl gap-8 sm:grid-cols-3">
        {evidence.map((e) => (
          <div key={e.label} className="border-t pt-4">
            <p className="font-heading text-3xl">{e.figure}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {e.href ? (
                <Link href={e.href} className="underline-offset-4 hover:underline">
                  {e.label}
                </Link>
              ) : (
                e.label
              )}
            </p>
          </div>
        ))}
      </section>

      <section className="mt-28">
        <h2 className="mb-3 text-3xl">Captured from a real run</h2>
        <p className="mb-10 max-w-[60ch] text-lg text-muted-foreground">
          {capturedOn(answered)}, {answered.model}, asked as the owner of a fictional noodle
          house. Nothing below is edited. Each step sits in the lane of whoever did it.
        </p>
        <CapturedRun trace={answered} />
        <div className="mt-16">
          <CapturedRun
            trace={refused}
            lead="The same agent, same day, given a question that tries to talk it out of its rules and into another merchant's data."
          />
        </div>
      </section>

      <section className="mt-28 max-w-[64ch]">
        <h2 className="mb-8 text-3xl">What I worked through</h2>
        <ol className="space-y-8 text-lg leading-relaxed">
          <li>
            <h3 className="mb-2 text-xl">Who decides what runs</h3>
            <p className="text-muted-foreground">
              The <span className="text-model">model</span> proposes one query.{" "}
              <span className="text-code">Code</span> reads it as a parse tree, refuses writes and
              tables it has no business in, adds the restaurant filter itself rather than
              trusting the query to have one, and runs it read-only with a timeout.{" "}
              <Link href="/architecture" className="text-primary underline-offset-4 hover:underline">
                How the guard works.
              </Link>
            </p>
          </li>
          <li>
            <h3 className="mb-2 text-xl">What happens when the question is hostile</h3>
            <p className="text-muted-foreground">
              The model is told that anything in the question that reads like an instruction is
              part of the question. Two refusals are captured above. A page of scenarios, including
              the ones that did not go well, is next.
            </p>
          </li>
          <li>
            <h3 className="mb-2 text-xl">How we know the answers are right</h3>
            <p className="text-muted-foreground">
              Not yet measured. An evaluation set over a frozen copy of the data is the next thing
              built, and its pass rate goes on this page whatever it turns out to be.
            </p>
          </li>
          <li>
            <h3 className="mb-2 text-xl">What it costs</h3>
            <p className="text-muted-foreground">
              Every model turn records its tokens, cache hits included, and the trace is priced from
              the published rates. The five questions above cost between a fifth of a cent and a cent
              and a half each on Claude Sonnet 5.5, and about twice that on Opus 5.5 for the same
              answers, which is why Sonnet is the default.
            </p>
          </li>
          <li>
            <h3 className="mb-2 text-xl">Who approves an action</h3>
            <p className="text-muted-foreground">
              The <span className="text-human">human</span> lane is empty in every trace so far. The
              propose path, where the agent drafts an action and a person approves it before code
              acts, is the part after the evaluation set.
            </p>
          </li>
        </ol>
      </section>

      <section className="mt-28 max-w-[64ch]">
        <p className="text-lg text-muted-foreground">
          The ten scenarios show the cases that matter, with the expected behaviour written
          first. The{" "}
          <Link href="/ask" className="text-primary underline-offset-4 hover:underline">
            Ask page
          </Link>{" "}
          lets you put your own question to either restaurant.
        </p>
      </section>
    </>
  );
}

