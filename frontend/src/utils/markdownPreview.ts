export type ParsedMarkdownTable = {
  next: number;
  header: string[];
  body: string[][];
};

function splitTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function isSeparatorCell(cell: string): boolean {
  return /^:?-{2,}:?$/.test(cell.trim());
}

function isTableSeparator(line: string | undefined): boolean {
  if (!line?.includes("|")) return false;
  const cells = splitTableRow(line);
  return cells.length > 0 && cells.every(isSeparatorCell);
}

export function isMarkdownTableStart(lines: string[], start: number): boolean {
  const header = lines[start];
  if (!header?.includes("|")) return false;
  return isTableSeparator(lines[start + 1]);
}

export function parseMarkdownTable(
  lines: string[],
  start: number,
): ParsedMarkdownTable | null {
  if (!isMarkdownTableStart(lines, start)) return null;

  const header = splitTableRow(lines[start] ?? "");
  const body: string[][] = [];
  let cursor = start + 2;

  while (cursor < lines.length && lines[cursor]?.includes("|")) {
    const row = splitTableRow(lines[cursor] ?? "");
    if (row.length === 0) break;
    body.push(row);
    cursor += 1;
  }

  return { next: cursor, header, body };
}
