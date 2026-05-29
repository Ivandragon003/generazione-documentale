import { TemplatePlaceholderService } from "../src/service/template-placeholder.service";

describe("TemplatePlaceholderService", () => {
  const service = new TemplatePlaceholderService();

  it("parses standard placeholders and keeps legacy supported types", () => {
    const parsed = service.parse(
      [
        "{{string:ente_appaltante}}",
        "{{date:data_pubblicazione}}",
        "{{currency:importo_base}}",
        "{{integer:durata_contratto_mesi}}",
        "{{boolean:rt_01_obbligatorio}}",
        "{{percentage:penale_ritardo_milestone}}",
        "{{text:oggetto_appalto}}",
        "{{number:punteggio_tecnico}}",
        "{{email:referente_email}}",
        "{{phone:referente_phone}}",
      ].join("\n"),
    );

    expect(parsed.errors).toEqual([]);
    expect(parsed.fields.map((field) => [field.name, field.type])).toEqual([
      ["ente_appaltante", "string"],
      ["data_pubblicazione", "date"],
      ["importo_base", "currency"],
      ["durata_contratto_mesi", "integer"],
      ["rt_01_obbligatorio", "boolean"],
      ["penale_ritardo_milestone", "percentage"],
      ["oggetto_appalto", "text"],
      ["punteggio_tecnico", "number"],
      ["referente_email", "email"],
      ["referente_phone", "phone"],
    ]);
  });

  it("builds a syntax spec aligned with parser supported types", () => {
    process.env.TEMPLATE_OFFICIAL_TYPES =
      "string,text,date,integer,boolean,list,email";
    const spec = service.buildTemplateSyntaxSpec();
    const profile = service.describeTemplateSyntaxProfile();
    expect(spec.supportedTypes).toEqual(profile.supportedTypes);
    expect(spec.compactGrammar).toContain("TEMPLATE PLACEHOLDER GRAMMAR");
    expect(spec.compactGrammar).toContain(profile.supportedTypes.join(", "));
    expect(spec.compactGrammar).toContain(
      "NON usare mai placeholder nei titoli Markdown",
    );
    expect(spec.compactGrammar).toContain(
      "Ogni sezione deve avere: titolo statico -> breve spiegazione descrittiva in italiano -> campi compilabili.",
    );
    expect(spec.compactGrammar).toContain(
      "label e valori CSV sono ammessi solo per placeholder di tipo list.",
    );
    expect(spec.compactGrammar).toContain("{{}} non e valido");
    expect(spec.compactGrammar).toContain("non usare campi contatto");
    expect(spec.canonicalExamples).toEqual(
      expect.arrayContaining([
        "{{string:nome_progetto:120:true}}",
        "{{text:descrizione_progetto:1000:true}}",
        "{{date:data_inizio:10:true}}",
      ]),
    );
    expect(spec.canonicalExamples).toEqual(
      expect.arrayContaining([
        "{{list:nome:80:true:nome_lista,Opzione1,Opzione2,Opzione3}}",
      ]),
    );
    expect(spec.canonicalExamples).not.toEqual(
      expect.arrayContaining(["{{number:valore_stimato:10:false}}"]),
    );
  });

  it("keeps untyped placeholders compatible as string fields", () => {
    const parsed = service.parse("{{ente_appaltante}}");

    expect(parsed.errors).toEqual([]);
    expect(parsed.legacyUntypedNames).toEqual(["ente_appaltante"]);
    expect(parsed.fields).toEqual([
      { raw: "{{ente_appaltante}}", type: "string", name: "ente_appaltante" },
    ]);
  });

  it("parses extended typed placeholders for normal fields", () => {
    const parsed = service.parse(
      "{{string:ente_appaltante:100:true}}\n{{integer:durata_mesi:3:false}}",
    );
    expect(parsed.errors).toEqual([]);
    expect(parsed.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "ente_appaltante",
          type: "string",
          maxLength: 100,
          required: true,
        }),
        expect.objectContaining({
          name: "durata_mesi",
          type: "integer",
          maxLength: 3,
          required: false,
        }),
      ]),
    );
  });

  it("parses extended list placeholders", () => {
    const parsed = service.parse(
      "{{list:tipologia_contratto:80:true:tipologie_contratto:Servizi,Forniture,Lavori}}",
    );
    expect(parsed.errors).toEqual([]);
    expect(parsed.fields[0]).toEqual(
      expect.objectContaining({
        name: "tipologia_contratto",
        type: "list",
        maxLength: 80,
        required: true,
        listName: "tipologie_contratto",
        listValues: ["Servizi", "Forniture", "Lavori"],
      }),
    );
  });

  it("parses official csv list placeholders", () => {
    const parsed = service.parse(
      "{{list:stato_cliente_1:100:true:cliente,Sospeso,In attesa}}",
    );

    expect(parsed.errors).toEqual([]);
    expect(parsed.fields[0]).toEqual(
      expect.objectContaining({
        name: "stato_cliente_1",
        type: "list",
        maxLength: 100,
        required: true,
        listLabel: "cliente",
        listName: "cliente",
        listValues: ["Sospeso", "In attesa"],
      }),
    );
  });

  it("rejects official csv list placeholders without options after label", () => {
    const parsed = service.parse("{{list:stato_cliente:100:true:Stato}}");

    expect(parsed.fields).toEqual([]);
    expect(parsed.errors.join("\n")).toContain("list options are required");
  });

  it("accepts canonical list syntax with explicit values", () => {
    const parsed = service.parse(
      "{{list:prova:100:true:livelli_impatto:Basso,Medio,Alto,Critico}}",
    );

    expect(parsed.errors).toEqual([]);
    expect(parsed.fields).toEqual([
      expect.objectContaining({
        name: "prova",
        type: "list",
        maxLength: 100,
        required: true,
        listName: "livelli_impatto",
        listValues: ["Basso", "Medio", "Alto", "Critico"],
      }),
    ]);
  });

  it("accepts official list syntax with option labels containing spaces", () => {
    const parsed = service.parse(
      "{{list:priorita:100:true:Priorita,bassa,media alta}}",
    );

    expect(parsed.errors).toEqual([]);
    expect(parsed.fields[0]).toEqual(
      expect.objectContaining({
        listValues: ["bassa", "media alta"],
      }),
    );
  });

  it("validates requested valid list placeholders", () => {
    const parsed = service.parse(
      [
        "{{list:priorita:100:true:Priorità:bassa,media,alta}}",
        "{{list:stato_progetto:50:false:Stato:bozza,approvato,archiviato}}",
        "{{string:nome_progetto:100:true}}",
        "{{text:descrizione_progetto:1000:true}}",
      ].join("\n"),
    );

    expect(parsed.errors).toEqual([]);
    expect(parsed.fields.map((field) => [field.name, field.type])).toEqual([
      ["priorita", "list"],
      ["stato_progetto", "list"],
      ["nome_progetto", "string"],
      ["descrizione_progetto", "text"],
    ]);
  });

  it.each([
    ["{{list:priorita}}", "list requires format"],
    ["{{list:priorita:100:true}}", "list label is required"],
    ["{{list:priorita:abc:true:Priorità:bassa,media}}", "Invalid length"],
    [
      "{{list:priorita:100:ture:Priorità:bassa,media}}",
      "Invalid required value",
    ],
    ["{{list:priorita:100:true:Priorità:}}", "list options are required"],
    [
      "{{lista:priorita:100:true:Priorità:bassa,media}}",
      'Invalid placeholder type: "lista". Did you mean "list"?',
    ],
  ])("rejects invalid official list placeholder %s", (token, expected) => {
    const parsed = service.parse(token);

    expect(parsed.fields).toEqual([]);
    expect(parsed.errors.join("\n")).toContain(expected);
  });

  it("rejects list-only parameters on non-list placeholders", () => {
    const parsed = service.parse(
      "{{string:nome_cliente:100:true:stati_cliente:Attivo,Sospeso}}",
    );

    expect(parsed.fields).toEqual([]);
    expect(parsed.errors).toContain(
      "Invalid placeholder {{string:nome_cliente:100:true:stati_cliente:Attivo,Sospeso}}: label and list options are only allowed for list placeholders",
    );
  });

  it("rejects list placeholders using literal length keyword", () => {
    const parsed = service.parse("{{list:obiettivi:length:true:obiettivi}}");
    expect(parsed.errors).toContain(
      'Invalid length: "length". It must be a number.',
    );
  });

  it("rejects list placeholders with required token instead of boolean", () => {
    const parsed = service.parse(
      "{{list:priorita:50:required:livelli_priorita:Bassa,Media,Alta}}",
    );
    expect(parsed.errors).toContain(
      'Invalid required value: "required". Use true or false.',
    );
  });

  it("rejects unsupported table type placeholders", () => {
    const parsed = service.parse(
      "{{table:stakeholder:length:true:stakeholder}}",
    );
    expect(parsed.errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining('unsupported type "table"'),
      ]),
    );
  });

  it("rejects unsupported table and subtable placeholders with canonical-looking parameters", () => {
    const parsed = service.parse(
      ["{{table:obiettivi:120:true}}", "{{subtable:rischi:120:true}}"].join(
        "\n",
      ),
    );

    expect(parsed.fields).toEqual([]);
    expect(parsed.errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining('unsupported type "table"'),
        expect.stringContaining('unsupported type "subtable"'),
      ]),
    );
  });

  it("does not include table or subtable placeholder examples in the syntax spec", () => {
    const spec = service.buildTemplateSyntaxSpec();

    expect((spec.canonicalExamples ?? []).join("\n")).not.toMatch(
      /\{\{(?:table|subtable):/i,
    );
    expect(spec.compactGrammar).not.toMatch(/\{\{(?:table|subtable):/i);
    expect(spec.compactGrammar).toContain(
      "table/subtable NON sono tipi placeholder supportati",
    );
  });

  it("validates field values for all primary types and legacy supported types", () => {
    const template = [
      "{{string:ente_appaltante}}",
      "{{text:oggetto_appalto}}",
      "{{date:data_pubblicazione}}",
      "{{currency:importo_base}}",
      "{{integer:durata_contratto_mesi}}",
      "{{boolean:rt_01_obbligatorio}}",
      "{{percentage:penale_ritardo_milestone}}",
      "{{number:punteggio_tecnico}}",
      "{{email:referente_email}}",
      "{{phone:referente_phone}}",
    ].join("\n");

    const valid = service.validateFieldValues(template, {
      ente_appaltante: "Comune di Roma",
      oggetto_appalto: "Servizi applicativi",
      data_pubblicazione: "2026-05-19",
      importo_base: "1234.56",
      durata_contratto_mesi: 24,
      rt_01_obbligatorio: "yes",
      penale_ritardo_milestone: 12.5,
      punteggio_tecnico: "87.75",
      referente_email: "ufficio@example.com",
      referente_phone: "+39 06 123456",
    });
    expect(valid.valid).toBe(true);
    expect(valid.errors).toEqual([]);

    const invalid = service.validateFieldValues(template, {
      ente_appaltante: "Comune di Roma",
      oggetto_appalto: "Servizi applicativi",
      data_pubblicazione: "non una data",
      importo_base: "mille",
      durata_contratto_mesi: 24.5,
      rt_01_obbligatorio: "forse",
      penale_ritardo_milestone: "dodici",
      punteggio_tecnico: "alto",
      referente_email: "email-non-valida",
      referente_phone: "abc",
    });
    expect(invalid.valid).toBe(false);
    expect(invalid.errors.join(" ")).toContain("data_pubblicazione");
    expect(invalid.errors.join(" ")).toContain("importo_base");
    expect(invalid.errors.join(" ")).toContain("durata_contratto_mesi");
    expect(invalid.errors.join(" ")).toContain("rt_01_obbligatorio");
    expect(invalid.errors.join(" ")).toContain("penale_ritardo_milestone");
    expect(invalid.errors.join(" ")).toContain("punteggio_tecnico");
    expect(invalid.errors.join(" ")).toContain("referente_email");
    expect(invalid.errors.join(" ")).toContain("referente_phone");
  });

  it("validates required and maxLength from extended placeholders", () => {
    const template = "{{string:ente_appaltante:5:true}}";
    const missing = service.validateFieldValues(template, {});
    expect(missing.valid).toBe(false);
    expect(missing.errors.join(" ")).toContain("Missing required field");

    const tooLong = service.validateFieldValues(template, {
      ente_appaltante: "123456",
    });
    expect(tooLong.valid).toBe(false);
    expect(tooLong.errors.join(" ")).toContain("exceeds maxLength");
  });

  it("renders typed values with English formats", () => {
    const result = service.render(
      [
        "Data: {{date:data_pubblicazione}}",
        "Importo: {{currency:importo_base}}",
        "Penale: {{percentage:penale_ritardo_milestone}}",
        "Obbligatorio: {{boolean:rt_01_obbligatorio}}",
        "Punteggio: {{number:punteggio_tecnico}}",
        "Email: {{email:referente_email}}",
        "Telefono: {{phone:referente_phone}}",
      ].join("\n"),
      {
        data_pubblicazione: "2026-05-19",
        importo_base: 1234.56,
        penale_ritardo_milestone: 12.5,
        rt_01_obbligatorio: true,
        punteggio_tecnico: 87.75,
        referente_email: "ufficio@example.com",
        referente_phone: "+39 06 123456",
      },
      true,
    );

    expect(result.unresolved).toEqual([]);
    expect(result.result).toContain("May 19, 2026");
    expect(result.result).toContain("1,234.56");
    expect(result.result).toContain("€");
    expect(result.result).toContain("12.5%");
    expect(result.result).toContain("Yes");
    expect(result.result).toContain("87.75");
    expect(result.result).toContain("ufficio@example.com");
    expect(result.result).toContain("+39 06 123456");
  });

  it("repairs split table rows when a placeholder cell is on the next line", () => {
    const template = [
      "| A | B | C | D |",
      "| --- | --- | --- | --- |",
      "| x | y | z |",
      "| {{boolean:flag}} |",
    ].join("\n");

    const result = service.render(template, { flag: true }, true);
    expect(result.result).toContain("| x | y | z | Yes |");
  });

  describe("fuzzy suggestions", () => {
    const template = "{{string:nome_cliente}}\n{{date:data_contratto}}";

    it("suggests a known field for a simple typo in fieldValues", () => {
      const validation = service.validateFieldValues(template, {
        nome_clietne: "ACME",
        data_contratto: "2026-05-21",
      });

      expect(validation.issues).toContainEqual({
        field: "nome_clietne",
        suggestedField: "nome_cliente",
        distance: 1,
        code: "UNKNOWN_FIELD",
        reason: "Field value does not match any template field",
      });
    });

    it("uses Damerau-Levenshtein transposition distance for adjacent letters", () => {
      expect(
        service.suggestFieldName("nome_cleinte", ["nome_cliente"]),
      ).toEqual({
        suggestedField: "nome_cliente",
        distance: 1,
      });
    });

    it("does not suggest when the field is too different", () => {
      expect(
        service.suggestFieldName("fornitore_esterno", [
          "nome_cliente",
          "data_contratto",
        ]),
      ).toEqual({ distance: null });
    });

    it("does not suggest when multiple candidates are similarly close", () => {
      expect(
        service.suggestFieldName("nome_clienti", [
          "nome_cliente",
          "nome_clienta",
        ]),
      ).toEqual({ distance: 1 });
    });

    it("keeps legacy untyped placeholders non-blocking", () => {
      const validation = service.validateFieldValues("{{nome_cliente}}", {
        nome_clietne: "ACME",
      });

      expect(validation.valid).toBe(true);
      expect(validation.errors).toEqual([]);
      expect(validation.issues).toContainEqual(
        expect.objectContaining({
          field: "nome_clietne",
          suggestedField: "nome_cliente",
          code: "UNKNOWN_FIELD",
        }),
      );
    });

    it("reports unknown placeholders against known field definitions", () => {
      const reports = service.getUnknownPlaceholderReports(
        "{{string:nome_clietne}}",
        [{ name: "nome_cliente" }],
      );

      expect(reports).toEqual([
        {
          field: "nome_clietne",
          suggestedField: "nome_cliente",
          distance: 1,
          code: "UNKNOWN_PLACEHOLDER",
          reason: "Placeholder does not match any known field",
        },
      ]);
    });
  });
});
