export const PLACEHOLDER_REGEX = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

export function extractPlaceholders(markdown: string): string[] {
  const matches = markdown.matchAll(PLACEHOLDER_REGEX);
  return [...new Set([...matches].map((match) => match[1]))];
}

export function renderMarkdown(markdown: string, values: Record<string, string>): string {
  return markdown.replace(PLACEHOLDER_REGEX, (_, key: string) => values[key] || `{{${key}}}`);
}

export function comparePlaceholderSets(previous: string[], next: string[]) {
  const prev = new Set(previous);
  const curr = new Set(next);
  const added = next.filter((key) => !prev.has(key));
  const removed = previous.filter((key) => !curr.has(key));
  const unchanged = added.length === 0 && removed.length === 0;
  return { added, removed, unchanged };
}
