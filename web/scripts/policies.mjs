// Copies the policy documents into the site as content, one section per
// entry keyed by the label the model cites, so a citation in an answer can
// open the section it refers to.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..", "..", "data", "policies");
const out = {};
for (const dir of readdirSync(root).filter((d) => d.startsWith("merchant_"))) {
  const merchantId = dir.replace(/\D/g, "");
  out[merchantId] = {};
  for (const file of readdirSync(join(root, dir)).filter((f) => f.endsWith(".md"))) {
    let title = file.replace(/\.md$/, "");
    let section = null;
    let lines = [];
    const flush = () => {
      const body = lines.join("\n").trim();
      const m = section?.match(/^(\d+)\. (.+)$/);
      if (m && body) {
        out[merchantId][`${title} §${m[1]}, ${m[2]}`] = { document: title, number: Number(m[1]), section: m[2], body };
      }
    };
    for (const line of readFileSync(join(root, dir, file), "utf8").split("\n")) {
      if (line.startsWith("## ")) {
        flush();
        section = line.slice(3).trim();
        lines = [];
      } else if (line.startsWith("# ")) {
        title = line.slice(2).trim();
      } else {
        lines.push(line);
      }
    }
    flush();
  }
}
writeFileSync(join(import.meta.dirname, "..", "src", "content", "policies.json"), JSON.stringify(out, null, 2) + "\n");
console.log(`wrote ${Object.values(out).reduce((n, m) => n + Object.keys(m).length, 0)} sections`);
