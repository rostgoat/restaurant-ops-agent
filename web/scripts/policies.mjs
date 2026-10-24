// Copies the policy documents into the site as content, one section per
// entry, so a citation in an answer can open the section it refers to.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..", "..", "data", "policies");
const out = {};
for (const dir of readdirSync(root).filter((d) => d.startsWith("merchant_"))) {
  const merchantId = dir.replace(/\D/g, "");
  out[merchantId] = {};
  for (const file of readdirSync(join(root, dir)).filter((f) => f.endsWith(".md"))) {
    const document = file.replace(/\.md$/, "");
    const sections = {};
    let title = document;
    let section = null;
    let lines = [];
    const flush = () => {
      if (section && lines.join("\n").trim()) sections[section] = lines.join("\n").trim();
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
    out[merchantId][document] = { title, sections };
  }
}
writeFileSync(join(import.meta.dirname, "..", "src", "content", "policies.json"), JSON.stringify(out, null, 2) + "\n");
console.log(`wrote policies for ${Object.keys(out).length} merchants`);
