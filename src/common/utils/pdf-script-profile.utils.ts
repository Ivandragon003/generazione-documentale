export type PdfScriptProfile = "latin" | "rtl" | "cjk";

const RTL_LANGS = new Set(["ar", "he", "fa", "ur"]);
const CJK_LANGS = new Set(["ja", "zh", "ko"]);

export const normalizeLanguage = (language: string | undefined): string => {
  if (!language) return "";
  return language.trim().toLowerCase().split("-")[0] ?? "";
};

export const determinePdfScriptProfileFromLanguage = (
  language: string | undefined,
): PdfScriptProfile => {
  const normalized = normalizeLanguage(language);
  if (RTL_LANGS.has(normalized)) return "rtl";
  if (CJK_LANGS.has(normalized)) return "cjk";
  return "latin";
};
