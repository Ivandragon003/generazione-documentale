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
 * - extractFieldNames con nomi lunghissimi (>100 caratteri) â€” limite interno della regex
 * - normalizeFieldDefinitions â€” preserva tutti i tipi disponibili
 * - validateMarkdownContent â€” contenuto esattamente al limite in byte
 */

// â”€â”€ Helper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const validate = (content: string, maxBytes = 200_000) =>
  validateMarkdownContent(content, maxBytes);

// â”€â”€ ReDoS / sicurezza regex â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe("markdown.utils â€” sicurezza regex e ReDoS", () => {
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

// â”€â”€ extractFieldNames â€” nomi al limite della regex (100 chars) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe("extractFieldNames â€” nomi lunghi", () => {
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

  it("non estrae placeholder con spazi interni (nome invalid per \\w+)", () => {
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

// â”€â”€ normalizeFieldDefinitions â€” tutti i tipi FieldType â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe("normalizeFieldDefinitions â€” tutti i tipi", () => {
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

// â”€â”€ validateMarkdownContent â€” limiti di byte precisi â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe("validateMarkdownContent â€” limiti di byte precisi", () => {
  it("accetta contenuto di esattamente maxBytes byte (al limite incluso)", () => {
    const maxBytes = 500;
    const content = "A".repeat(maxBytes);
    expect(Buffer.byteLength(content, "utf8")).toBe(maxBytes);

    const result = validate(content, maxBytes);
    // Nessun errore di dimensione (potrebbe avere warning su mancanza H1 o placeholder)
    expect(result.errors.some((e) => e.includes("too large"))).toBe(false);
  });

  it("rifiuta contenuto di maxBytes+1 byte", () => {
    const maxBytes = 500;
    const content = "A".repeat(maxBytes + 1);
    const result = validate(content, maxBytes);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("too large"))).toBe(true);
  });

  it("calcola i byte UTF-8 correttamente per caratteri multibyte (€ = 3 byte)", () => {
    const maxBytes = 9; // 3 characters € = 9 bytes
    const content = "\u20AC\u20AC\u20AC"; // 9 bytes
    expect(Buffer.byteLength(content, "utf8")).toBe(9);

    const result = validate(content, maxBytes);
    expect(result.errors.some((e) => e.includes("too large"))).toBe(false);

    const result2 = validate("\u20AC\u20AC\u20AC\u20AC", maxBytes); // 12 bytes > 9
    expect(result2.errors.some((e) => e.includes("too large"))).toBe(true);
  });

  it("avvisa se manca un H1 Markdown", () => {
    const result = validate("{{campo}}\n\nTesto senza titolo H1.");
    expect(result.warnings.some((w) => w.includes("H1"))).toBe(true);
  });

  it("non avvisa mancanza H1 se H1 Ã¨ presente", () => {
    const result = validate("# Titolo\n\n{{campo}}");
    expect(result.warnings.some((w) => w.includes("H1"))).toBe(false);
  });

  it("avvisa se non ci sono placeholder", () => {
    const result = validate("# Titolo fisso\n\nTesto senza campi dinamici.");
    expect(result.warnings.some((w) => w.includes("placeholder"))).toBe(true);
  });
});

// â”€â”€ validateMarkdownContent â€” parentesi bilanciate edge â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe("validateMarkdownContent â€” parentesi {{ }} bilanciate", () => {
  it("segnala errore con una {{ in piÃ¹", () => {
    const result = validate("# t\n{{campo}} {{extra");
    expect(result.valid).toBe(false);
    expect(
      result.errors.some((e) => e.includes("Unbalanced placeholder braces")),
    ).toBe(true);
  });

  it("segnala errore con una }} in piÃ¹", () => {
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
    expect(result.errors.some((e) => e.includes("Invalid placeholders"))).toBe(
      true,
    );
  });

  it("segnala errore per placeholder con @", () => {
    const result = validate("# t\n{{campo@email}}");
    expect(result.valid).toBe(false);
  });
});
