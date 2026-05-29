import {
  isMarkdownTableStart,
  parseMarkdownTable,
} from "../frontend/src/utils/markdownPreview";
import {
  extractPlaceholderDefinitions,
  fieldTypeHelperText,
  formatFieldValueForPreview,
  initialFieldValues,
  inputPlaceholderForField,
  labelFromName,
  mergeFieldValues,
  normalizeFieldDefinitions,
  parsePlaceholderToken,
  placeholderTokenForField,
  validateFieldValues,
} from "../frontend/src/utils/template";

describe("frontend template preview helpers", () => {
  const markdown = [
    "# Template",
    "Prezzo: {{currency:prezzo_backend}}",
    "Durata: {{integer:durata_mesi}}",
    "Attivo: {{boolean:rt_01_obbligatorio}}",
    "Data: {{date:data_pubblicazione}}",
    "Penale: {{percentage:penale_ritardo}}",
    "",
    "| Voce | Importo |",
    "| --- | ---: |",
    "| Backend | {{currency:prezzo_backend}} |",
  ].join("\n");

  it("keeps typed placeholder tokens while exposing simplified field names", () => {
    const placeholders = extractPlaceholderDefinitions(markdown);
    expect(placeholders).toEqual(
      expect.arrayContaining([
        {
          raw: "{{currency:prezzo_backend}}",
          name: "prezzo_backend",
          type: "currency",
        },
        {
          raw: "{{boolean:rt_01_obbligatorio}}",
          name: "rt_01_obbligatorio",
          type: "boolean",
        },
      ]),
    );

    const fields = normalizeFieldDefinitions(markdown);
    expect(fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "prezzo_backend",
          type: "currency",
          rawPlaceholder: "{{currency:prezzo_backend}}",
        }),
      ]),
    );
    expect(placeholderTokenForField(fields[0])).toBe(
      "{{currency:prezzo_backend}}",
    );
  });

  it("builds readable labels from field names", () => {
    expect(labelFromName("partecipante_1_ruolo")).toBe(
      "Partecipante 1 - Ruolo",
    );
    expect(labelFromName("data_riunione")).toBe("Data riunione");
    expect(labelFromName("importo_totale")).toBe("Importo totale");
  });

  it("uses user-facing input placeholders instead of template tokens", () => {
    const fields = normalizeFieldDefinitions(
      [
        "{{string:partecipante_1_ruolo}}",
        "{{text:oggetto_appalto}}",
        "{{date:data_riunione}}",
        "{{currency:importo_totale}}",
        "{{integer:durata_mesi}}",
        "{{percentage:iva}}",
        "{{number:punteggio}}",
        "{{email:referente_email}}",
        "{{phone:referente_phone}}",
        "{{boolean:rt_01_obbligatorio}}",
      ].join("\n"),
    );
    const byName = new Map(fields.map((field) => [field.name, field]));

    expect(inputPlaceholderForField(byName.get("partecipante_1_ruolo"))).toBe(
      "Enter Partecipante 1 - Ruolo",
    );
    expect(inputPlaceholderForField(byName.get("oggetto_appalto"))).toBe(
      "Enter a description...",
    );
    expect(inputPlaceholderForField(byName.get("data_riunione"))).toBe(
      "Select a date",
    );
    expect(inputPlaceholderForField(byName.get("importo_totale"))).toBe(
      "E.g. 1,200.00",
    );
    expect(inputPlaceholderForField(byName.get("durata_mesi"))).toBe("E.g. 10");
    expect(inputPlaceholderForField(byName.get("iva"))).toBe("E.g. 22%");
    expect(inputPlaceholderForField(byName.get("punteggio"))).toBe("E.g. 10.5");
    expect(inputPlaceholderForField(byName.get("referente_email"))).toBe(
      "name@company.com",
    );
    expect(inputPlaceholderForField(byName.get("referente_phone"))).toBe(
      "+39 ...",
    );
    expect(inputPlaceholderForField(byName.get("rt_01_obbligatorio"))).toBe("");
    expect(fieldTypeHelperText(byName.get("importo_totale"), true)).toBe(
      "Type: currency",
    );
    expect(fieldTypeHelperText(byName.get("importo_totale"))).toBe("");

    for (const field of fields) {
      expect(inputPlaceholderForField(field)).not.toContain("{{");
      expect(inputPlaceholderForField(field)).not.toContain("}}");
    }
  });

  it("does not seed input values from technical placeholder defaults", () => {
    const fields = normalizeFieldDefinitions(
      "{{string:partecipante_1_ruolo}}",
      [
        {
          name: "partecipante_1_ruolo",
          type: "string",
          defaultValue: "{{partecipante_1_ruolo}}",
        },
      ],
    );

    expect(initialFieldValues(fields)).toEqual({
      partecipante_1_ruolo: "",
    });
  });

  it("updates field values with a single merged source of truth", () => {
    const merged = mergeFieldValues(
      { ente_appaltante: "Comune di Roma", importo_base: 1200 },
      { ente_appaltante: "", importo_base: "", data_pubblicazione: "" },
    );

    expect(merged).toEqual({
      ente_appaltante: "Comune di Roma",
      importo_base: 1200,
      data_pubblicazione: "",
    });
  });

  it("validates field values by type", () => {
    const fields = normalizeFieldDefinitions(
      [
        "{{currency:importo_base}}",
        "{{integer:durata_mesi}}",
        "{{date:data_pubblicazione}}",
        "{{boolean:accettato}}",
      ].join("\n"),
    );

    const errors = validateFieldValues(fields, {
      importo_base: "abc",
      durata_mesi: 12,
      data_pubblicazione: "19/05/2026",
      accettato: "si",
    });

    expect(errors).toEqual({
      importo_base: "Invalid number",
      data_pubblicazione: "Invalid date",
      accettato: "Invalid boolean",
    });
  });

  it("formats preview values for typed placeholders", () => {
    expect(formatFieldValueForPreview("currency", 1234.56)).toBe(
      "1,234.56 \u20ac",
    );
    expect(formatFieldValueForPreview("integer", 24)).toBe("24");
    expect(formatFieldValueForPreview("boolean", true)).toBe("Yes");
    expect(formatFieldValueForPreview("boolean", false)).toBe("No");
    expect(formatFieldValueForPreview("date", "2026-05-19")).toBe(
      "May 19, 2026",
    );
    expect(formatFieldValueForPreview("percentage", 12.5)).toBe("12.5%");
    expect(formatFieldValueForPreview("number", 87.75)).toBe("87.75");
  });

  it("detects and parses GitHub Flavored Markdown tables", () => {
    const lines = markdown.split(/\r?\n/);
    const tableStart = lines.findIndex((line) => line.startsWith("| Voce"));
    expect(isMarkdownTableStart(lines, tableStart)).toBe(true);

    const table = parseMarkdownTable(lines, tableStart);
    expect(table).toEqual(
      expect.objectContaining({
        next: tableStart + 3,
        header: ["Voce", "Importo"],
        body: [["Backend", "{{currency:prezzo_backend}}"]],
      }),
    );
  });

  it("parses tables with typed placeholders in cells before rendering placeholders", () => {
    const lines = [
      "| ID | Servizio | Totale |",
      "| --- | --- | --- |",
      "| OF-01 | Dev Backend | {{currency:tot_backend}} |",
    ];

    const table = parseMarkdownTable(lines, 0);

    expect(table).toEqual({
      next: 3,
      header: ["ID", "Servizio", "Totale"],
      body: [["OF-01", "Dev Backend", "{{currency:tot_backend}}"]],
    });
  });

  it("parses tables with long cell content", () => {
    const longDescription =
      "Servizio di sviluppo backend con integrazione API, validazione template e generazione documentale";
    const lines = [
      "| ID | Descrizione | Totale |",
      "| --- | --- | ---: |",
      `| OF-01 | ${longDescription} | {{currency:tot_backend}} |`,
    ];

    const table = parseMarkdownTable(lines, 0);

    expect(table?.header).toEqual(["ID", "Descrizione", "Totale"]);
    expect(table?.body).toEqual([
      ["OF-01", longDescription, "{{currency:tot_backend}}"],
    ]);
  });

  it("accepts legacy table separator rows with two dashes", () => {
    const lines = [
      "| ID | Servizio | Totale |",
      "| -- | -- | -- |",
      "| OF-01 | Dev Backend | {{currency:tot_backend}} |",
    ];

    expect(isMarkdownTableStart(lines, 0)).toBe(true);
    expect(parseMarkdownTable(lines, 0)).toEqual(
      expect.objectContaining({
        header: ["ID", "Servizio", "Totale"],
        body: [["OF-01", "Dev Backend", "{{currency:tot_backend}}"]],
      }),
    );
  });

  it("parses extended list placeholders and maps options", () => {
    const markdownList =
      "{{list:tipologia_contratto:80:true:Tipologia contratto:Servizi,Forniture,Lavori}}";
    const fields = normalizeFieldDefinitions(markdownList);
    expect(fields[0]).toEqual(
      expect.objectContaining({
        name: "tipologia_contratto",
        label: "Tipologia contratto",
        type: "list",
        required: true,
        maxLength: 80,
        listName: "tipologia_contratto",
      }),
    );
    expect(fields[0]?.options).toEqual([
      { label: "Servizi", value: "Servizi" },
      { label: "Forniture", value: "Forniture" },
      { label: "Lavori", value: "Lavori" },
    ]);
  });

  it("does not expose invalid list placeholders as preview fields", () => {
    expect(
      extractPlaceholderDefinitions("{{list:priorita:100:true:Priorità:}}"),
    ).toEqual([]);
    expect(
      parsePlaceholderToken("{{list:priorita:100:true:Priorità:}}").invalid
        ?.message,
    ).toContain("missing options");
  });

  it("does not expose empty placeholders as preview fields", () => {
    expect(extractPlaceholderDefinitions("Cliente: {{}}")).toEqual([]);
    expect(parsePlaceholderToken("{{}}").invalid?.message).toContain(
      "Invalid placeholder format",
    );
  });

  it("rejects list-only parameters on non-list frontend placeholders", () => {
    expect(
      extractPlaceholderDefinitions(
        "{{string:nome_cliente:100:true:stati_cliente:Attivo,Sospeso}}",
      ),
    ).toEqual([]);
  });

  it("validates maxLength on frontend field values", () => {
    const fields = normalizeFieldDefinitions("{{string:code:3:true}}");
    const errors = validateFieldValues(fields, { code: "1234" });
    expect(errors).toEqual({ code: "Max 3 chars" });
  });
});
