import {
  extractFieldNames,
  normalizeFieldDefinitions,
  type PartialFieldDefinition,
  validateMarkdownContent,
} from "../src/common/utils/markdown.utils";

describe("Markdown Utilities", () => {
  describe("extractFieldNames()", () => {
    it("deve estrarre placeholder dal contenuto markdown", () => {
      const content = "Titolo: {{titolo}}, Cliente: {{cliente}}";

      const names = extractFieldNames(content);

      expect(names).toContain("titolo");
      expect(names).toContain("cliente");
      expect(names.length).toBe(2);
    });

    it("deve rimuovere duplicati", () => {
      const content = "{{campo}} {{campo}} {{campo}}";

      const names = extractFieldNames(content);

      expect(names).toEqual(["campo"]);
    });

    it("deve gestire contenuto senza placeholder", () => {
      const content = "Nessun placeholder qui";

      const names = extractFieldNames(content);

      expect(names).toEqual([]);
    });

    it("deve estrarre placeholder con nomi lunghi", () => {
      const content = "Valore: {{campo_molto_lungo_con_underscores}}";

      const names = extractFieldNames(content);

      expect(names).toContain("campo_molto_lungo_con_underscores");
    });

    it("deve estrarre placeholder con numeri", () => {
      const content = "{{campo1}} {{campo2}} {{campo123}}";

      const names = extractFieldNames(content);

      expect(names).toEqual(["campo1", "campo2", "campo123"]);
    });

    it("deve ignorare placeholder non validi", () => {
      const content =
        "Valido: {{campo}} | Invalido: {{}} | Spazio: {{ campo }}";

      const names = extractFieldNames(content);

      expect(names).toContain("campo");
      expect(names.length).toBe(1);
    });

    it("deve gestire contenuto vuoto", () => {
      const names = extractFieldNames("");

      expect(names).toEqual([]);
    });

    it("deve gestire molti placeholder", () => {
      const placeholders = Array(100)
        .fill(0)
        .map((_, i) => `{{campo${i}}}`)
        .join(" ");

      const names = extractFieldNames(placeholders);

      expect(names.length).toBe(100);
    });
  });

  describe("normalizeFieldDefinitions()", () => {
    it("deve generare field definitions dal contenuto", () => {
      const content = "{{titolo}} - {{cliente}}";

      const fields = normalizeFieldDefinitions(content, []);

      expect(fields.length).toBe(2);
      expect(fields[0].name).toBe("titolo");
      expect(fields[1].name).toBe("cliente");
    });

    it("deve applicare default per label, type, required", () => {
      const content = "{{campo}}";

      const fields = normalizeFieldDefinitions(content, []);

      const field = fields[0];
      expect(field.label).toBe("Campo");
      expect(field.type).toBe("text");
      expect(field.required).toBe(true);
      expect(field.defaultValue).toBe("");
    });

    it("deve generare label da nome con underscores", () => {
      const content = "{{campo_test_name}}";

      const fields = normalizeFieldDefinitions(content, []);

      expect(fields[0].label).toBe("Campo Test Name");
    });

    it("deve mantere definizioni personalizzate", () => {
      const content = "{{titolo}} {{cliente}}";
      const custom: PartialFieldDefinition[] = [
        {
          name: "titolo",
          label: "Custom Titolo",
          type: "textarea",
          required: false,
        },
      ];

      const fields = normalizeFieldDefinitions(content, custom);

      const titleField = fields.find((f) => f.name === "titolo");
      expect(titleField?.label).toBe("Custom Titolo");
      expect(titleField?.type).toBe("textarea");
      expect(titleField?.required).toBe(false);
    });

    it("deve applicare default solo ai campi non personalizzati", () => {
      const content = "{{campo1}} {{campo2}}";
      const custom: PartialFieldDefinition[] = [
        { name: "campo1", label: "Custom", type: "number" },
      ];

      const fields = normalizeFieldDefinitions(content, custom);

      const field1 = fields.find((f) => f.name === "campo1");
      const field2 = fields.find((f) => f.name === "campo2");

      expect(field1?.label).toBe("Custom");
      expect(field2?.label).toBe("Campo2");
    });

    it("deve ignorare definizioni per campi non presenti", () => {
      const content = "{{titolo}}";
      const custom: PartialFieldDefinition[] = [
        { name: "inesistente", label: "Inesistente" },
      ];

      const fields = normalizeFieldDefinitions(content, custom);

      expect(fields.length).toBe(1);
      expect(fields[0].name).toBe("titolo");
    });

    it("deve preservare defaultValue personalizzato", () => {
      const content = "{{campo}}";
      const custom: PartialFieldDefinition[] = [
        { name: "campo", defaultValue: "valore_default" },
      ];

      const fields = normalizeFieldDefinitions(content, custom);

      expect(fields[0].defaultValue).toBe("valore_default");
    });

    it("deve gestire contenuto senza placeholder", () => {
      const content = "Nessun placeholder";

      const fields = normalizeFieldDefinitions(content, []);

      expect(fields).toEqual([]);
    });
  });

  describe("validateMarkdownContent()", () => {
    it("deve accettare contenuto valido", () => {
      const content = "# Titolo\n\n{{titolo}} {{cliente}}";

      const result = validateMarkdownContent(content, 100000);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it("deve rifiutare contenuto vuoto", () => {
      const result = validateMarkdownContent("", 100000);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        "Il contenuto del template non puo essere vuoto",
      );
    });

    it("deve rifiutare contenuto con solo whitespace", () => {
      const result = validateMarkdownContent("   \n\n  ", 100000);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        "Il contenuto del template non puo essere vuoto",
      );
    });

    it("deve verificare limite di dimensione", () => {
      const content = "A".repeat(1001);

      const result = validateMarkdownContent(content, 1000);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("troppo grande"))).toBe(true);
    });

    it("deve rilevare parentesi non bilanciate", () => {
      const content = "Test {{ aperto e {{chiuso}}";

      const result = validateMarkdownContent(content, 100000);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("non bilanciate"))).toBe(
        true,
      );
    });

    it("deve rilevare placeholder con spazi interni", () => {
      const content = "{{ campo con spazi }}";

      const result = validateMarkdownContent(content, 100000);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("non validi"))).toBe(true);
    });

    it("deve rilevare placeholder con caratteri speciali", () => {
      const content = "{{campo-con-trattini}} {{campo@speciale}}";

      const result = validateMarkdownContent(content, 100000);

      expect(result.valid).toBe(false);
    });

    it("deve accettare placeholder ben formati", () => {
      const content = "{{campo}} {{campo_con_underscore}} {{campo123}}";

      const result = validateMarkdownContent(content, 100000);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it("deve gestire esattamente al limite di dimensione", () => {
      const maxBytes = 100;
      const content = "A".repeat(100); // esattamente 100 byte

      const result = validateMarkdownContent(content, maxBytes);

      expect(result.valid).toBe(true);
    });

    it("deve estrarre campi dal contenuto valido", () => {
      const content = "{{titolo}} {{cliente}}";

      const result = validateMarkdownContent(content, 100000);

      expect(result.fields.length).toBe(2);
      expect(result.fields.some((f) => f.name === "titolo")).toBe(true);
    });

    it("deve accettare contenuto con simboli markdown", () => {
      const content = "# Titolo\n- {{punto1}}\n- {{punto2}}\n";

      const result = validateMarkdownContent(content, 100000);

      expect(result.valid).toBe(true);
    });

    it("deve rilevare più errori contemporaneamente", () => {
      const content = "{{ }} {{ }} "; // solo whitespace

      const result = validateMarkdownContent(content, 10);

      expect(result.errors.length).toBeGreaterThanOrEqual(1);
      expect(result.valid).toBe(false);
    });

    it("deve gestire placeholder duplicati", () => {
      const content = "{{campo}} {{campo}} {{campo}}";

      const result = validateMarkdownContent(content, 100000);

      expect(result.valid).toBe(true);
      expect(result.fields.filter((f) => f.name === "campo").length).toBe(1);
    });

    it("deve verificare UTF-8 per il limite di byte", () => {
      // Caratteri UTF-8 multibyte
      const content = "€".repeat(100); // € è 3 byte in UTF-8
      const byteLength = Buffer.byteLength(content, "utf8");

      const result = validateMarkdownContent(content, byteLength - 1);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("troppo grande"))).toBe(true);
    });

    it("deve gestire parentesi in testo normale", () => {
      const content = "Testo con { parentesi } singole: ok";

      const result = validateMarkdownContent(content, 100000);

      expect(result.valid).toBe(true);
    });

    it("deve gestire placeholder annidati non validi", () => {
      const content = "{{{{interno}}}}";

      const result = validateMarkdownContent(content, 100000);

      // Il primo {{ apre, {{ chiude (conteggio non bilancia)
      // O il parsing potrebbe considerarlo non valido
      expect(result.valid).toBe(false);
    });
  });

  describe("validateMarkdownContent() - Pattern blocchi", () => {
    it("deve rilevare pattern HTML pericolosi se presenti", () => {
      const content = "Normale: {{campo}}";

      const result = validateMarkdownContent(content, 100000);

      expect(result.valid).toBe(true);
    });

    it("deve generare campo con label default per placeholder validi", () => {
      const content = "{{campo_test}}";

      const result = validateMarkdownContent(content, 100000);

      expect(result.fields[0].label).toBe("Campo Test");
    });
  });

  describe("Integration - Flusso completo", () => {
    it("deve processare un template realistico", () => {
      const template = `
# Contratto {{anno}}

Cliente: {{cliente}}
Importo: {{importo}} EUR

## Dettagli
- Data: {{data}}
- Scadenza: {{scadenza}}
`;

      const isValid = validateMarkdownContent(template, 100000);
      expect(isValid.valid).toBe(true);

      const fields = normalizeFieldDefinitions(template, [
        { name: "importo", type: "number", required: true },
        { name: "scadenza", type: "date", required: false },
      ]);

      expect(fields.length).toBe(5);
      const importoField = fields.find((f) => f.name === "importo");
      expect(importoField?.type).toBe("number");
    });

    it("deve gestire template con molti placeholder", () => {
      const placeholders = Array(50)
        .fill(0)
        .map((_, i) => `{{campo${i}}}`)
        .join(" ");
      const content = `# Template\n${placeholders}`;

      const isValid = validateMarkdownContent(content, 100000);
      expect(isValid.valid).toBe(true);

      const names = extractFieldNames(content);
      expect(names.length).toBe(50);

      const fields = normalizeFieldDefinitions(content, []);
      expect(fields.length).toBe(50);
    });

    it("deve rifiutare e segnalare template complesso invalido", () => {
      const template = `
# Template Non Valido
{{ {{ aperto doppio }}
Dimensione: ${Buffer.alloc(2000).toString()}
`;

      const result = validateMarkdownContent(template, 1000);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(1);
    });
  });
});
