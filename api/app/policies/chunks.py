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
        return f"{self.document}: {self.section}"

    @property
    def text(self) -> str:
        return f"{self.label}\n{self.body}"


def parse_document(merchant_id: int, document: str, markdown: str) -> list[Chunk]:
    chunks: list[Chunk] = []
    section: str | None = None
    lines: list[str] = []

    def flush() -> None:
        body = "\n".join(lines).strip()
        if section and body:
            chunks.append(Chunk(merchant_id, document, section, body))

    for line in markdown.splitlines():
        if line.startswith("## "):
            flush()
            section = line[3:].strip()
            lines = []
        elif line.startswith("# "):
            continue
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
