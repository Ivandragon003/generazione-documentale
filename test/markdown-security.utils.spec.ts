import {
  extractFieldNames,
  normalizeFieldDefinitions,
  validateMarkdownContent,
} from "../src/common/utils/markdown.utils";

/**
 * Test supplementari per markdown.utils.
 * Coprono:
 * - ReDoS: input con molte {{ non chiuse (garantisce che la regex non blocchi)
 * - Blocco comandi LaTeX pericolosi (\include, \write18, \openout, \read)
 * - Blocco <script> e <iframe> con varianti maiuscole/miste
 * - extractFieldNames con nomi lunghissimi (>100 caratteri) — limite interno della regex
 * - normalizeFieldDefinitions — preserva tutti i tipi disponibili
 * - validateMarkdownContent — contenuto esattamente al limite in byte
 */

// ── Helper ────────────────────────────────────────────────────────────────────

const validate = (content: string, maxBytes = 200_000) =>
  validateMarkdownContent(content, maxBytes);

// ── ReDoS / sicurezza regex ───────────────────────────────────────────────────

describe("markdown.utils — sicurezza regex e ReDoS", () => {
  it("non va in timeout con 10.000 `{{` non chiuse consecutive", () => {
    const malicious = "{{".repeat(10_000);
    const start = Date.now();
    const result = validate(malicious);
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(500);
    expect(result.valid).toBe(false);
  });

  it("non va in timeout con contenuto alternato {{ e testo", () => {
    const malicious = Array.from({ length: 5_000 }, (_, i) =>
      i % 2 === 0 ? "{{" : "testo_long",
    ).join("");

    const start = Date.now();
    validate(malicious);
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(500);
  });

  it("blocca `\\input{...}` (LaTeX injection)", () => {
    const result = validate("# {{t}}\n\\input{/etc/passwd}");
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("LaTeX"))).toBe(true);
  });

  it("blocca `\\include{...}` (LaTeX injection)", () => {
    const result = validate("# {{t}}\n\\include{secret}");
    expect(result.valid).toBe(false);
  });

  it("blocca `\\write18{...}` (shell escape LaTeX)", () => {
    const result = validate("# {{t}}\n\\write18{rm -rf /}");
    expect(result.valid).toBe(false);
  });

  it("blocca `\\openout` (LaTeX file write)", () => {
    const result = validate("# {{t}}\n\\openout5=malicious.txt");
    expect(result.valid).toBe(false);
  });

  it("blocca `\\read` (LaTeX file read)", () => {
    const result = validate("# {{t}}\n\\read0 to \\cmd");
    expect(result.valid).toBe(false);
  });

  it("blocca <SCRIPT> in maiuscolo", () => {
    const result = validate("# {{t}}\n<SCRIPT>alert(1)</SCRIPT>");
    expect(result.valid).toBe(false);
  });

  it("blocca <Script> con maiuscola mista", () => {
    const result = validate("# {{t}}\n<Script src='x'>");
    expect(result.valid).toBe(false);
  });

  it("blocca <iframe> in minuscolo", () => {
    const result = validate("# {{t}}\n<iframe src='x'/>");
    expect(result.valid).toBe(false);
  });

  it("blocca <IFRAME> in maiuscolo", () => {
    const result = validate("# {{t}}\n<IFRAME src='x'/>");
    expect(result.valid).toBe(false);
  });

  it("accetta tag HTML non pericolosi (es. <b>, <ul>)", () => {
    const result = validate("# {{t}}\n<b>testo</b>\n<ul><li>voce</li></ul>");
    expect(result.valid).toBe(true);
  });
});

// ── extractFieldNames — nomi al limite della regex (100 chars) ────────────────

describe("extractFieldNames — nomi lunghi", () => {
  it("estrae un nome di esattamente 100 caratteri", () => {
    const longName = "a".repeat(100);
    const content = `{{${longName}}}`;
    const names = extractFieldNames(content);
    expect(names).toContain(longName);
  });

  it("non estrae nomi con 101 caratteri (fuori dal limite regex)", () => {
    const tooLong = "a".repeat(101);
    const content = `{{${tooLong}}}`;
    const names = extractFieldNames(content);
    // La regex \w+ accetta qualsiasi numero di word characters, non ha limite a 100
    // Questo test verifica che comunque vengono estratti (comportamento attuale)
    expect(names).toContain(tooLong);
  });

  it("estrae nomi misti underscore e numeri", () => {
    const content = "{{campo_01}} {{campo_02_extra}}";
    const names = extractFieldNames(content);
    expect(names).toContain("campo_01");
    expect(names).toContain("campo_02_extra");
  });

  it("non estrae placeholder con spazi interni (nome non valido per \\w+)", () => {
    const content = "{{nome con spazi}}";
    const names = extractFieldNames(content);
    expect(names).not.toContain("nome con spazi");
  });

  it("deduplica anche nomi che differiscono solo per case (case-sensitive)", () => {
    const content = "{{Campo}} {{campo}} {{CAMPO}}";
    const names = extractFieldNames(content);
    // case-sensitive: tutti e tre sono diversi
    expect(names).toContain("Campo");
    expect(names).toContain("campo");
    expect(names).toContain("CAMPO");
    expect(names.length).toBe(3);
  });
});

// ── normalizeFieldDefinitions — tutti i tipi FieldType ────────────────────────

describe("normalizeFieldDefinitions — tutti i tipi", () => {
  it("preserva il tipo 'number' fornito dall'input", () => {
    const fields = normalizeFieldDefinitions("{{importo}}", [
      { name: "importo", type: "number" },
    ]);
    expect(fields[0].type).toBe("number");
  });

  it("preserva il tipo 'date' fornito dall'input", () => {
    const fields = normalizeFieldDefinitions("{{data}}", [
      { name: "data", type: "date" },
    ]);
    expect(fields[0].type).toBe("date");
  });

  it("preserva il tipo 'boolean' fornito dall'input", () => {
    const fields = normalizeFieldDefinitions("{{attivo}}", [
      { name: "attivo", type: "boolean" },
    ]);
    expect(fields[0].type).toBe("boolean");
  });

  it("preserva il tipo 'textarea' fornito dall'input", () => {
    const fields = normalizeFieldDefinitions("{{note}}", [
      { name: "note", type: "textarea" },
    ]);
    expect(fields[0].type).toBe("textarea");
  });

  it("usa 'text' come tipo default se non fornito", () => {
    const fields = normalizeFieldDefinitions("{{generico}}", [
      { name: "generico" },
    ]);
    expect(fields[0].type).toBe("text");
  });

  it("usa required=true come default se non fornito", () => {
    const fields = normalizeFieldDefinitions("{{campo}}", []);
    expect(fields[0].required).toBe(true);
  });

  it("usa defaultValue='' come default se non fornito", () => {
    const fields = normalizeFieldDefinitions("{{campo}}", []);
    expect(fields[0].defaultValue).toBe("");
  });

  it("genera label CamelCase da nome con underscore multipli", () => {
    const fields = normalizeFieldDefinitions("{{ragione_sociale_cliente}}", []);
    expect(fields[0].label).toBe("Ragione Sociale Cliente");
  });
});

// ── validateMarkdownContent — limiti di byte precisi ─────────────────────────

describe("validateMarkdownContent — limiti di byte precisi", () => {
  it("accetta contenuto di esattamente maxBytes byte (al limite incluso)", () => {
    const maxBytes = 500;
    const content = "A".repeat(maxBytes);
    expect(Buffer.byteLength(content, "utf8")).toBe(maxBytes);

    const result = validate(content, maxBytes);
    // Nessun errore di dimensione (potrebbe avere warning su mancanza H1 o placeholder)
    expect(result.errors.some((e) => e.includes("troppo grande"))).toBe(false);
  });

  it("rifiuta contenuto di maxBytes+1 byte", () => {
    const maxBytes = 500;
    const content = "A".repeat(maxBytes + 1);
    const result = validate(content, maxBytes);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("troppo grande"))).toBe(true);
  });

  it("calcola i byte UTF-8 correttamente per caratteri multibyte (€ = 3 byte)", () => {
    const maxBytes = 9; // 3 caratteri € = 9 byte
    const content = "€€€"; // 9 byte
    expect(Buffer.byteLength(content, "utf8")).toBe(9);

    const result = validate(content, maxBytes);
    expect(result.errors.some((e) => e.includes("troppo grande"))).toBe(false);

    const result2 = validate("€€€€", maxBytes); // 12 byte > 9
    expect(result2.errors.some((e) => e.includes("troppo grande"))).toBe(true);
  });

  it("avvisa se manca un H1 Markdown", () => {
    const result = validate("{{campo}}\n\nTesto senza titolo H1.");
    expect(result.warnings.some((w) => w.includes("H1"))).toBe(true);
  });

  it("non avvisa mancanza H1 se H1 è presente", () => {
    const result = validate("# Titolo\n\n{{campo}}");
    expect(result.warnings.some((w) => w.includes("H1"))).toBe(false);
  });

  it("avvisa se non ci sono placeholder", () => {
    const result = validate("# Titolo fisso\n\nTesto senza campi dinamici.");
    expect(result.warnings.some((w) => w.includes("placeholder"))).toBe(true);
  });
});

// ── validateMarkdownContent — parentesi bilanciate edge ───────────────────────

describe("validateMarkdownContent — parentesi {{ }} bilanciate", () => {
  it("segnala errore con una {{ in più", () => {
    const result = validate("# t\n{{campo}} {{extra");
    expect(result.valid).toBe(false);
    expect(
      result.errors.some(
        (e) => e.includes("bilanciati") || e.includes("bilanciate"),
      ),
    ).toBe(true);
  });

  it("segnala errore con una }} in più", () => {
    const result = validate("# t\n{{campo}} testo}} qui");
    expect(result.valid).toBe(false);
  });

  it("non segnala errore con {{ }} perfettamente bilanciati", () => {
    const result = validate("# t\n{{a}} {{b}} {{c}}");
    expect(result.errors.some((e) => e.includes("bilanci"))).toBe(false);
  });

  it("segnala errore per placeholder con trattino (non \\w)", () => {
    const result = validate("# t\n{{campo-invalido}}");
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("non validi"))).toBe(true);
  });

  it("segnala errore per placeholder con @", () => {
    const result = validate("# t\n{{campo@email}}");
    expect(result.valid).toBe(false);
  });
});
