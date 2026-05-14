import {
  extractFieldNames,
  normalizeFieldDefinitions,
  parseTemplatePlaceholders,
  validateMarkdownContent,
} from "../src/common/utils/markdown.utils";

describe("markdown typed placeholders", () => {
  it("accepts valid placeholders and builds field definitions", () => {
    const content =
      "# Doc\n{{date:data_offerta}}\n{{currency:totale_ivato}}\n{{number:qty_backend}}";

    const result = validateMarkdownContent(content, 100_000);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "data_offerta",
          type: "date",
          required: true,
          source: "template",
        }),
        expect.objectContaining({
          name: "totale_ivato",
          type: "currency",
          required: true,
          source: "template",
        }),
      ]),
    );
  });

  it("accepts legacy placeholders without type as implicit string", () => {
    const result = validateMarkdownContent("{{data_offerta}}", 100_000);
    expect(result.valid).toBe(true);
    expect(result.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "data_offerta", type: "string" }),
      ]),
    );
    expect(result.warnings.join(" ")).toContain("Legacy placeholders");
  });

  it("rejects unsupported type", () => {
    const result = validateMarkdownContent("{{money:totale}}", 100_000);
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toContain('unsupported type "money"');
  });

  it("rejects invalid field_name", () => {
    const result = validateMarkdownContent("{{date:DataOfferta}}", 100_000);
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toContain("field_name");
  });

  it("deduplicates same field with same type", () => {
    const content = "{{date:data_offerta}}\n{{date:data_offerta}}";
    const parsed = parseTemplatePlaceholders(content);
    expect(parsed.errors).toEqual([]);
    expect(parsed.fields).toHaveLength(1);
    expect(parsed.fields[0]).toMatchObject({
      name: "data_offerta",
      type: "date",
    });
  });

  it("rejects same field with different types", () => {
    const content = "{{date:data_offerta}}\n{{string:data_offerta}}";
    const result = validateMarkdownContent(content, 100_000);
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toContain("Conflicting placeholder types");
  });

  it("handles template without placeholders", () => {
    const result = validateMarkdownContent("# Titolo", 100_000);
    expect(result.valid).toBe(true);
    expect(result.fields).toEqual([]);
    expect(result.warnings.join(" ")).toContain("No dynamic fields found");
  });

  it("extracts only typed placeholder field names", () => {
    const names = extractFieldNames(
      "{{string:nome_cliente}} {{date:data_offerta}}",
    );
    expect(names).toEqual(["nome_cliente", "data_offerta"]);
  });

  it("normalizeFieldDefinitions keeps detected types", () => {
    const fields = normalizeFieldDefinitions(
      "{{percentage:sconto_percentuale}} {{integer:qty_backend}}",
    );
    expect(fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "sconto_percentuale",
          type: "percentage",
        }),
        expect.objectContaining({
          name: "qty_backend",
          type: "integer",
        }),
      ]),
    );
  });
});
