// The request path as the trace draws it: model steps violet, code steps
// teal, the person crimson. Inline SVG so it follows the theme.

type Tone = "model" | "code" | "human" | "plain";

const stroke: Record<Tone, string> = {
  model: "var(--model)",
  code: "var(--code)",
  human: "var(--human)",
  plain: "var(--border)",
};

function Box({
  x,
  y,
  w,
  h,
  tone,
  title,
  lines = [],
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  tone: Tone;
  title: string;
  lines?: string[];
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={8}
        style={{
          stroke: stroke[tone],
          strokeWidth: 1.5,
          fill: tone === "plain" ? "var(--muted)" : `color-mix(in oklab, ${stroke[tone]} 10%, transparent)`,
        }}
      />
      <text x={x + 14} y={y + 24} className="font-heading" style={{ fontSize: 15, fontWeight: 600, fill: "var(--foreground)" }}>
        {title}
      </text>
      {lines.map((line, i) => (
        <text key={line} x={x + 14} y={y + 44 + i * 17} style={{ fontSize: 12.5, fill: "var(--muted-foreground)" }}>
          {line}
        </text>
      ))}
    </g>
  );
}

function Arrow({ d, label, lx, ly, dashed = false }: { d: string; label?: string; lx?: number; ly?: number; dashed?: boolean }) {
  return (
    <g>
      <path d={d} fill="none" markerEnd="url(#arrow)" style={{ stroke: "var(--muted-foreground)", strokeWidth: 1.25, strokeDasharray: dashed ? "4 4" : undefined }} />
      {label && lx !== undefined && ly !== undefined && (
        <text x={lx} y={ly} textAnchor="middle" style={{ fontSize: 10.5, fill: "var(--muted-foreground)" }}>
          {label}
        </text>
      )}
    </g>
  );
}

export function ArchitectureDiagram() {
  // Two lanes: the model on the left, code on the right. The person is at the top and bottom.
  const M = { x: 40, w: 290 };
  const C = { x: 450, w: 290 };
  return (
    <div className="overflow-x-auto">
      <svg
        viewBox="0 0 760 1060"
        role="img"
        aria-label="The request path: the owner asks, the model picks a tool, code checks and runs it, the model answers, the owner approves anything that would change something, and code records it."
        className="min-w-[640px] w-full font-sans"
      >
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" style={{ fill: "var(--muted-foreground)" }} />
          </marker>
        </defs>

        {/* lane titles */}
        <text x={M.x} y={22} className="font-heading" style={{ fontSize: 13, fontWeight: 600, fill: "var(--model)", letterSpacing: 1 }}>MODEL</text>
        <text x={C.x} y={22} className="font-heading" style={{ fontSize: 13, fontWeight: 600, fill: "var(--code)", letterSpacing: 1 }}>CODE</text>
        <text x={C.x + C.w} y={22} textAnchor="end" style={{ fontSize: 11.5, fill: "var(--muted-foreground)" }}>the model cannot cross this line</text>

        {/* the code boundary */}
        <rect x={C.x - 16} y={34} width={C.w + 32} height={860} rx={12} fill="none" style={{ stroke: "var(--code)", strokeWidth: 1, strokeDasharray: "6 5", opacity: 0.6 }} />

        {/* the owner asks */}
        <Box x={M.x} y={50} w={M.w} h={66} tone="human" title="The owner asks a question" lines={["The restaurant comes from the request,", "never from the question."]} />
        <Arrow d={`M ${M.x + 150} 116 L ${M.x + 150} 146`} />

        {/* the model picks a tool */}
        <Box x={M.x} y={150} w={M.w} h={48} tone="model" title="The model reads it and picks one tool" />

        {/* run_sql */}
        <Arrow d={`M ${M.x + 150} 198 L ${M.x + 150} 228`} />
        <text x={M.x + 160} y={218} style={{ fontSize: 11.5, fill: "var(--muted-foreground)" }}>one of the four below</text>
        <Box x={M.x} y={232} w={M.w} h={66} tone="model" title="run_sql" lines={["Proposes one SELECT and says", "what it answers."]} />
        <Arrow d={`M ${M.x + M.w} 252 L ${C.x} 252`} />
        <Box x={C.x} y={232} w={C.w} h={66} tone="code" title="Guard" lines={["Eight checks on the parse tree. Every table", "is swapped for one scoped to this restaurant."]} />
        <Arrow d={`M ${C.x + 150} 298 L ${C.x + 150} 322`} />
        <Box x={C.x} y={326} w={C.w} h={48} tone="code" title="Database" lines={["Read-only transaction, statement timeout."]} />
        <Arrow d={`M ${C.x} 350 L ${M.x + M.w} 350`} label="rows, or the error" lx={390} ly={342} dashed />

        {/* search_policy */}
        <Box x={M.x} y={400} w={M.w} h={66} tone="model" title="search_policy" lines={["Asks for the sections of this", "restaurant's written rules that apply."]} />
        <Arrow d={`M ${M.x + M.w} 420 L ${C.x} 420`} />
        <Box x={C.x} y={400} w={C.w} h={66} tone="code" title="Retrieve" lines={["This restaurant's sections only, and only", "those scoring above the threshold."]} />
        <Arrow d={`M ${C.x} 452 L ${M.x + M.w} 452`} label="sections, or none" lx={390} ly={444} dashed />

        {/* propose */}
        <Box x={M.x} y={500} w={M.w} h={66} tone="model" title="propose" lines={["A structured action: a dispute, a", "campaign, a comp, a note to the owner."]} />
        <Arrow d={`M ${M.x + M.w} 520 L ${C.x} 520`} />
        <Box x={C.x} y={500} w={C.w} h={66} tone="code" title="Check the proposal" lines={["Dispute windows, discount caps, consent,", "the audience recounted from the data."]} />
        <Arrow d={`M ${C.x} 552 L ${M.x + M.w} 552`} label="pending or blocked" lx={390} ly={544} dashed />

        {/* decline */}
        <Box x={M.x} y={600} w={M.w} h={48} tone="model" title="decline" lines={["With a reason. Nothing runs."]} />

        {/* answer */}
        <Arrow d={`M ${M.x + 150} 648 L ${M.x + 150} 678`} />
        <Box x={M.x} y={682} w={M.w} h={66} tone="model" title="The model answers" lines={["In prose, citing the sections it used", "as [House Policy §2, Comps]."]} />
        <Arrow d={`M ${M.x + M.w} 702 L ${C.x} 702`} />
        <Box x={C.x} y={682} w={C.w} h={66} tone="code" title="Citation check" lines={["Every section cited must be one that", "was retrieved."]} />

        {/* the owner reads and decides */}
        <Arrow d={`M ${M.x + 150} 748 L ${M.x + 150} 778`} />
        <Box x={M.x} y={782} w={M.w} h={66} tone="human" title="The owner reads the answer" lines={["A proposal waits here. Nothing has", "happened yet."]} />
        <Arrow d={`M ${M.x + M.w} 802 L ${C.x} 802`} label="approve or reject" lx={390} ly={794} />
        <Box x={C.x} y={782} w={C.w} h={66} tone="code" title="Record the action" lines={["Approved: a labelled simulated record.", "Rejected: the reason, and nothing else."]} />

        {/* the trace */}
        <Box x={M.x} y={900} w={C.x + C.w - M.x} h={64} tone="plain" title="The trace" lines={["Every step above is written down as it happens: who did it, what it decided, what it cost, how long it took.", "The Scenarios and Evaluation pages are made of these."]} />
        <circle cx={M.x + 100} cy={923} r={4} style={{ fill: "var(--model)" }} />
        <circle cx={M.x + 112} cy={923} r={4} style={{ fill: "var(--code)" }} />
        <circle cx={M.x + 124} cy={923} r={4} style={{ fill: "var(--human)" }} />

        {/* legend */}
        <g style={{ fontSize: 12, fill: "var(--muted-foreground)" }}>
          <rect x={M.x} y={1000} width={12} height={12} rx={3} style={{ fill: "var(--model)" }} />
          <text x={M.x + 18} y={1010}>the model decided</text>
          <rect x={M.x + 150} y={1000} width={12} height={12} rx={3} style={{ fill: "var(--code)" }} />
          <text x={M.x + 168} y={1010}>fixed code ran</text>
          <rect x={M.x + 290} y={1000} width={12} height={12} rx={3} style={{ fill: "var(--human)" }} />
          <text x={M.x + 308} y={1010}>a person acted</text>
        </g>
      </svg>
    </div>
  );
}
