import {
  determinePdfScriptProfileFromLanguage,
  normalizeLanguage,
} from "../src/common/utils/pdf-script-profile.utils";

describe("pdf-script-profile utils", () => {
  it("maps rtl languages to rtl profile", () => {
    expect(determinePdfScriptProfileFromLanguage("ar")).toBe("rtl");
    expect(determinePdfScriptProfileFromLanguage("he")).toBe("rtl");
    expect(determinePdfScriptProfileFromLanguage("fa")).toBe("rtl");
    expect(determinePdfScriptProfileFromLanguage("ur")).toBe("rtl");
  });

  it("maps cjk languages to cjk profile", () => {
    expect(determinePdfScriptProfileFromLanguage("ja")).toBe("cjk");
    expect(determinePdfScriptProfileFromLanguage("zh")).toBe("cjk");
    expect(determinePdfScriptProfileFromLanguage("ko")).toBe("cjk");
  });

  it("maps european ltr languages to latin profile", () => {
    expect(determinePdfScriptProfileFromLanguage("it")).toBe("latin");
    expect(determinePdfScriptProfileFromLanguage("en")).toBe("latin");
    expect(determinePdfScriptProfileFromLanguage("fr")).toBe("latin");
    expect(determinePdfScriptProfileFromLanguage("es")).toBe("latin");
    expect(determinePdfScriptProfileFromLanguage("de")).toBe("latin");
    expect(determinePdfScriptProfileFromLanguage("pt")).toBe("latin");
  });

  it("falls back to latin for unknown or missing language", () => {
    expect(determinePdfScriptProfileFromLanguage(undefined)).toBe("latin");
    expect(determinePdfScriptProfileFromLanguage("xx")).toBe("latin");
  });

  it("normalizes locale tags", () => {
    expect(normalizeLanguage("AR-SA")).toBe("ar");
    expect(normalizeLanguage("ja-JP")).toBe("ja");
    expect(normalizeLanguage("en-US")).toBe("en");
    expect(normalizeLanguage(" it ")).toBe("it");
  });
});
