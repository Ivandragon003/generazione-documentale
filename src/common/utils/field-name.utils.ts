export function normalizeFieldName(fieldName: string): string {
  return fieldName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .replace(/^(\d)/, "_$1")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function titleFromFieldName(fieldName: string): string | null {
  const normalized = normalizeFieldName(fieldName);
  if (!normalized) return null;
  const parts = normalized.split("_").filter(Boolean);
  if (parts.length === 0) return null;
  return parts
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
