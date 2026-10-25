from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Chunk:
    merchant_id: int
    document: str
    section: str
    body: str

    @property
    def label(self) -> str:
        return label_for(self.document, self.section)

    @property
    def text(self) -> str:
        return f"{self.label}\n{self.body}"


SECTION = re.compile(r"^(\d+)\. (.+)$")


def label_for(document: str, section: str) -> str:
    """'House Policy' + '2. Comps' -> 'House Policy §2, Comps', the form the model cites."""
    m = SECTION.match(section)

    if not m:
        return f"{document}: {section}"

    return f"{document} §{m.group(1)}, {m.group(2)}"


def parse_document(merchant_id: int, document: str, markdown: str) -> list[Chunk]:
    """The H1 names the document; each numbered H2 is one chunk."""
    chunks: list[Chunk] = []
    title = document
    section: str | None = None
    lines: list[str] = []

    def flush() -> None:
        body = "\n".join(lines).strip()

        if section and body:
            chunks.append(Chunk(merchant_id, title, section, body))

    for line in markdown.splitlines():
        if line.startswith("## "):
            flush()
            section = line[3:].strip()
            lines = []
        elif line.startswith("# "):
            title = line[2:].strip()
        else:
            lines.append(line)
    flush()

    return chunks


def read_policies(root: Path) -> list[Chunk]:
    chunks: list[Chunk] = []

    for merchant_dir in sorted(root.glob("merchant_*")):
        merchant_id = int(re.sub(r"\D", "", merchant_dir.name))

        for path in sorted(merchant_dir.glob("*.md")):
            chunks.extend(parse_document(merchant_id, path.stem, path.read_text()))

    return chunks
