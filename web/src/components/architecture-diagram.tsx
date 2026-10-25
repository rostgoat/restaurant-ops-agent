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
  // The owner sits above and below. Between them, two lanes: the model on the
  // left, code on the right.
  const M = { x: 40, w: 290 };
  const C = { x: 450, w: 290 };
  const full = { x: M.x, w: C.x + C.w - M.x };

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox="0 0 760 1115"
        role="img"
        aria-label="The request path: the owner asks, the model picks tools, code checks and runs them, the model answers, the owner approves or rejects, and code records it."
        className="min-w-[640px] w-full font-sans"
      >
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" style={{ fill: "var(--muted-foreground)" }} />
          </marker>
        </defs>

        {/* the owner asks */}
        <Box x={full.x} y={10} w={full.w} h={56} tone="human" title="The owner asks a question" lines={["Signed in as one restaurant."]} />
        <Arrow d={`M ${M.x + 145} 66 L ${M.x + 145} 108`} />

        {/* lane titles */}
        <text x={M.x} y={98} className="font-heading" style={{ fontSize: 13, fontWeight: 600, fill: "var(--model)", letterSpacing: 1 }}>MODEL</text>
        <text x={C.x} y={98} className="font-heading" style={{ fontSize: 13, fontWeight: 600, fill: "var(--code)", letterSpacing: 1 }}>CODE</text>
        <text x={C.x + C.w} y={98} textAnchor="end" style={{ fontSize: 11.5, fill: "var(--muted-foreground)" }}>the model cannot cross this line</text>
        <rect x={C.x - 16} y={108} width={C.w + 32} height={664} rx={12} fill="none" style={{ stroke: "var(--code)", strokeWidth: 1, strokeDasharray: "6 5", opacity: 0.6 }} />

        {/* the model picks tools */}
        <Box x={M.x} y={112} w={M.w} h={56} tone="model" title="The model picks a tool" lines={["One or more of the four below, in any order."]} />
        <Arrow d={`M ${M.x + 145} 168 L ${M.x + 145} 196`} />

        {/* run_sql */}
        <Box x={M.x} y={200} w={M.w} h={56} tone="model" title="tool: run_sql" lines={["Writes one SELECT."]} />
        <Arrow d={`M ${M.x + M.w} 218 L ${C.x} 218`} />
        <Box x={C.x} y={200} w={C.w} h={74} tone="code" title="Guard" lines={["Eight checks. Blocks writes. Adds the", "restaurant filter to every table."]} />
        <Arrow d={`M ${C.x + 145} 274 L ${C.x + 145} 298`} />
        <Box x={C.x} y={302} w={C.w} h={56} tone="code" title="Database" lines={["Read only. Slow queries time out."]} />
        <Arrow d={`M ${C.x} 330 H 390 V 238 H ${M.x + M.w}`} label="rows, or the error" lx={390} ly={344} dashed />

        {/* search_policy */}
        <Box x={M.x} y={386} w={M.w} h={56} tone="model" title="tool: search_policy" lines={["Asks for the rules on a topic."]} />
        <Arrow d={`M ${M.x + M.w} 404 L ${C.x} 404`} />
        <Box x={C.x} y={386} w={C.w} h={74} tone="code" title="Retrieve" lines={["This restaurant's sections only, and only", "those above the score threshold."]} />
        <Arrow d={`M ${C.x} 430 L ${M.x + M.w} 430`} label="sections, or none" lx={390} ly={444} dashed />

        {/* propose */}
        <Box x={M.x} y={490} w={M.w} h={74} tone="model" title="tool: propose" lines={["A dispute, a campaign, a comp, or a", "note to the owner."]} />
        <Arrow d={`M ${M.x + M.w} 510 L ${C.x} 510`} />
        <Box x={C.x} y={490} w={C.w} h={74} tone="code" title="Check the proposal" lines={["Dispute windows, discount caps, consent,", "audience count."]} />
        <Arrow d={`M ${C.x} 540 L ${M.x + M.w} 540`} label="pending or blocked" lx={390} ly={554} dashed />

        {/* decline */}
        <Box x={M.x} y={594} w={M.w} h={56} tone="model" title="tool: decline" lines={["Says why. Nothing runs."]} />

        {/* answer */}
        <Arrow d={`M ${M.x + 145} 650 L ${M.x + 145} 678`} />
        <Box x={M.x} y={682} w={M.w} h={74} tone="model" title="The model answers" lines={["Cites sections it used, like", "[House Policy §2, Comps]."]} />
        <Arrow d={`M ${M.x + M.w} 702 L ${C.x} 702`} />
        <Box x={C.x} y={682} w={C.w} h={74} tone="code" title="Citation check" lines={["Every cited section must be one", "that was retrieved."]} />

        {/* the owner decides */}
        <Arrow d={`M ${M.x + 145} 756 L ${M.x + 145} 870`} />
        <Box x={full.x} y={874} w={full.w} h={56} tone="human" title="The owner reads the answer" lines={["Approves or rejects a proposal. Until then nothing has happened."]} />
        <Arrow d={`M ${C.x + 145} 930 L ${C.x + 145} 958`} />
        <Box x={C.x} y={962} w={C.w} h={56} tone="code" title="Record the action" lines={["A simulated record, marked as such."]} />

        {/* the trace */}
        <Box x={full.x} y={1046} w={full.w} h={56} tone="plain" title="The trace" lines={["Every step above is recorded: who did it, what it decided, what it cost, how long it took."]} />
        <circle cx={M.x + 100} cy={1069} r={4} style={{ fill: "var(--model)" }} />
        <circle cx={M.x + 112} cy={1069} r={4} style={{ fill: "var(--code)" }} />
        <circle cx={M.x + 124} cy={1069} r={4} style={{ fill: "var(--human)" }} />
      </svg>
    </div>
  );
}
