import { OllamaAiProvider } from "../src/service/ai/ollama-ai.provider";

describe("OllamaAiProvider", () => {
  const originalFetch = global.fetch;
  const originalBaseUrl = process.env.OLLAMA_BASE_URL;
  const originalModel = process.env.OLLAMA_MODEL;
  const originalCompactChars = process.env.OLLAMA_COMPACT_PROMPT_CHARS;
  const originalMaxChars = process.env.OLLAMA_MAX_PROMPT_CHARS;
  const originalDraftNumPredict = process.env.OLLAMA_DRAFT_NUM_PREDICT;

  beforeEach(() => {
    process.env.OLLAMA_BASE_URL = "http://localhost:11434";
    process.env.OLLAMA_MODEL = "qwen2.5:7b";
    process.env.OLLAMA_COMPACT_PROMPT_CHARS = "14000";
    process.env.OLLAMA_MAX_PROMPT_CHARS = "20000";
    process.env.OLLAMA_DRAFT_NUM_PREDICT = "1337";
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.OLLAMA_BASE_URL = originalBaseUrl;
    process.env.OLLAMA_MODEL = originalModel;
    process.env.OLLAMA_COMPACT_PROMPT_CHARS = originalCompactChars;
    process.env.OLLAMA_MAX_PROMPT_CHARS = originalMaxChars;
    process.env.OLLAMA_DRAFT_NUM_PREDICT = originalDraftNumPredict;
    jest.restoreAllMocks();
  });

  it("throws on invalid JSON response", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ response: "not-json-response" }),
    }) as typeof fetch;

    const provider = new OllamaAiProvider();

    await expect(
      provider.analyzeTemplate({
        markdown: "Data di nascita: {{string:data_nascita}}",
        fields: [
          {
            fieldName: "data_nascita",
            currentType: "string",
            surroundingText: "Data di nascita",
            fullLine: "Data di nascita: {{string:data_nascita}}",
            allowedTypes: ["string", "date"],
          },
        ],
        allowedTypes: ["string", "date"],
      }),
    ).rejects.toThrow("Ollama returned invalid JSON");
  });

  it("throws on unreachable or failed endpoint", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({}),
    }) as typeof fetch;

    const provider = new OllamaAiProvider();

    await expect(
      provider.analyzeTemplate({
        markdown: "Importo totale: {{string:importo_totale}}",
        fields: [
          {
            fieldName: "importo_totale",
            currentType: "string",
            surroundingText: "Importo totale",
            fullLine: "Importo totale: {{string:importo_totale}}",
            allowedTypes: ["string", "currency"],
          },
        ],
        allowedTypes: ["string", "currency"],
      }),
    ).rejects.toThrow("Ollama request failed: 503");
  });

  it("includes syntax spec in guided draft prompt", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        response: "# Doc\n\nCliente: {{string:nome_cliente}}",
      }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const provider = new OllamaAiProvider();
    await provider.generateTemplateDraft({
      description: "Contratto",
      language: "it",
      generationMode: "guided",
      syntaxProfile: {
        fieldNamePattern: "^[a-z_][a-z0-9_]*$",
        supportedTypes: ["string", "date", "list"],
        variants: [
          {
            id: "strict",
            format: "{{type:field_name}}",
            example: "{{string:nome_cliente}}",
          },
          {
            id: "extendedList",
            format: "{{list:field_name:length:required:label,value_a,value_b}}",
            example: "{{list:priorita:100:true:Priorità:bassa,media,alta}}",
          },
        ],
      },
      syntaxSpec: {
        version: "template-syntax-spec-v1",
        parserVersion: "1.0.0",
        supportedTypes: ["string", "date", "list"],
        compactGrammar:
          "TEMPLATE PLACEHOLDER GRAMMAR\n- {{list:nome:80:true:nome_lista,Opzione1,Opzione2,Opzione3}}",
        canonicalExamples: [
          "{{string:nome_progetto:120:true}}",
          "{{date:data_inizio:10:true}}",
          "{{currency:budget_preliminare:12:true}}",
          "{{list:priorita:80:true:nome_lista,Opzione1,Opzione2,Opzione3}}",
        ],
      },
    });
    const body = JSON.parse(
      (fetchMock.mock.calls[0] ?? [])[1].body as string,
    ) as {
      prompt: string;
    };
    expect(body.prompt).toContain("TEMPLATE PLACEHOLDER GRAMMAR");
    expect(body.prompt).toContain(
      "NON inserire placeholder nei titoli Markdown",
    );
    expect(body.prompt).toContain(
      "Non aggiungere note finali o testo fuori template",
    );
    expect(body.prompt).toContain(
      "Non aggiungere label o valori CSV a tipi diversi da list.",
    );
    expect(body.prompt).toContain("ultimo parametro CSV");
    expect(body.prompt).toContain("Non generare placeholder vuoti");
    expect(body.prompt).toContain(
      "{{list:nome:80:true:nome_lista,Opzione1,Opzione2,Opzione3}}",
    );
    expect(body.prompt).toContain("{{string:nome_progetto:120:true}}");
    expect(body.prompt).toContain("{{date:data_inizio:10:true}}");
    expect(body.prompt).toContain("{{currency:budget_preliminare:12:true}}");
    expect(body.prompt).toContain(
      "Produci un template Markdown completo e concluso",
    );
    expect(body.prompt).toContain("COMMON_PROMPT_RULES");
    expect(body.prompt).toContain("DOCUMENT_TYPE_PROFILE");
    expect(body.prompt).toContain("DOMAIN_PROFILE");
    expect(body.prompt).toContain(
      "Non applicare standard/sezioni di altri tipi documento quando non richiesti dal profilo attivo.",
    );
    expect(body.prompt).not.toContain(
      "Per Project Charter usa ESATTAMENTE queste 18 sezioni",
    );
  });

  it("includes syntax spec in free draft prompt too", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        response: "# Doc\n\nCliente: {{string:nome_cliente}}",
      }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const provider = new OllamaAiProvider();
    await provider.generateTemplateDraft({
      description: "Contratto",
      language: "it",
      generationMode: "free",
      syntaxProfile: {
        fieldNamePattern: "^[a-z_][a-z0-9_]*$",
        supportedTypes: ["string", "date", "list"],
        variants: [
          {
            id: "strict",
            format: "{{type:field_name}}",
            example: "{{string:nome_cliente}}",
          },
          {
            id: "extendedList",
            format: "{{list:field_name:length:required:label,value_a,value_b}}",
            example: "{{list:priorita:100:true:Priorità:bassa,media,alta}}",
          },
        ],
      },
      syntaxSpec: {
        version: "template-syntax-spec-v1",
        parserVersion: "1.0.0",
        supportedTypes: ["string", "date", "list"],
        compactGrammar:
          "TEMPLATE PLACEHOLDER GRAMMAR\n- {{list:nome:80:true:nome_lista,Opzione1,Opzione2,Opzione3}}",
      },
    });
    const body = JSON.parse(
      (fetchMock.mock.calls[0] ?? [])[1].body as string,
    ) as {
      prompt: string;
    };
    expect(body.prompt).toContain("TEMPLATE PLACEHOLDER GRAMMAR");
    expect(body.prompt).toContain("[OFFICIAL_PLACEHOLDER_SYNTAX]");
  });

  it("enables compact mode when prompt exceeds compact threshold", async () => {
    process.env.OLLAMA_COMPACT_PROMPT_CHARS = "500";
    process.env.OLLAMA_MAX_PROMPT_CHARS = "12000";
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ response: "# Doc\n\nCampo: {{string:campo}}" }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    const provider = new OllamaAiProvider();
    const logSpy = jest
      .spyOn(
        (provider as unknown as { logger: { log: (msg: string) => void } })
          .logger,
        "log",
      )
      .mockImplementation(() => undefined);
    await provider.generateTemplateDraft({
      description:
        "Richiesta utente molto lunga da conservare integralmente\n\n[BACKEND_INTENT_NORMALIZATION]\ndocument_type=project_charter\ndomain=project_management\npurpose=project_charter\naudience=sponsor,pm\nformality=media\n[END_BACKEND_INTENT_NORMALIZATION]\n[COMMON_PROMPT_RULES]\na\nb\nc\nd\ne\nf\n[END_COMMON_PROMPT_RULES]\n[DOCUMENT_TYPE_PROFILE]\nprofile_active=project_charter\nprofile_active=scheda\ncontent_directives=" +
        new Array(30).fill("direttiva_lunga").join(" | ") +
        "\nrequired_sections_by_type=Titolo | Obiettivi\nrecommended_table_sections=Obiettivi del progetto | Rischi iniziali\ntable_schemas=" +
        new Array(30).fill("schema=>a,b,c").join(" | ") +
        " | Obiettivi del progetto=>Obiettivo,Descrizione,Metrica,Target | Rischi iniziali=>Rischio,Descrizione,Probabilita,Impatto,Mitigazione\n[END_DOCUMENT_TYPE_PROFILE]\n[DOMAIN_PROFILE]\nprofile_active=project_management\nprofile_active=assicurativo\nsemantic_rules=allineare obiettivi | evitare ambiguita\nrecommended_terms=milestone | stakeholder\n[END_DOMAIN_PROFILE]\n[USER_EXPLICIT_REQUIREMENTS]\nrequired_sections_from_user=Obiettivi | Rischi\n[END_USER_EXPLICIT_REQUIREMENTS]\n[OUTPUT_CONSTRAINTS]\nsingle_markdown_document=true\nno_json=true\navoid_truncated_output=true\n[END_OUTPUT_CONSTRAINTS]",
      language: "it",
      generationMode: "guided",
      syntaxProfile: {
        fieldNamePattern: "^[a-z_][a-z0-9_]*$",
        supportedTypes: ["string", "date", "list"],
        variants: [
          {
            id: "strict",
            format: "{{type:field_name}}",
            example: "{{string:n}}",
          },
        ],
      },
      syntaxSpec: {
        version: "v1",
        parserVersion: "1.0.0",
        supportedTypes: ["string", "date", "list"],
        compactGrammar: "TEMPLATE PLACEHOLDER GRAMMAR\n- {{string:nome}}",
      },
    });
    const rawBody = JSON.parse(
      (fetchMock.mock.calls[0] ?? [])[1].body as string,
    ) as {
      prompt: string;
      options: { num_predict: number };
    };
    const nonCompactProvider = new OllamaAiProvider();
    const nonCompactPrompt = (
      nonCompactProvider as unknown as {
        buildTemplateDraftPrompt: (
          input: Parameters<OllamaAiProvider["generateTemplateDraft"]>[0],
          compactMode: boolean,
        ) => string;
      }
    ).buildTemplateDraftPrompt(
      {
        description:
          "Richiesta utente molto lunga da conservare integralmente\n\n[BACKEND_INTENT_NORMALIZATION]\ndocument_type=project_charter\ndomain=project_management\npurpose=project_charter\naudience=sponsor,pm\nformality=media\n[END_BACKEND_INTENT_NORMALIZATION]\n[COMMON_PROMPT_RULES]\na\nb\nc\nd\ne\nf\n[END_COMMON_PROMPT_RULES]\n[DOCUMENT_TYPE_PROFILE]\nprofile_active=project_charter\nprofile_active=scheda\ncontent_directives=" +
          new Array(30).fill("direttiva_lunga").join(" | ") +
          "\nrequired_sections_by_type=Titolo | Obiettivi\nrecommended_table_sections=Obiettivi del progetto | Rischi iniziali\ntable_schemas=" +
          new Array(30).fill("schema=>a,b,c").join(" | ") +
          " | Obiettivi del progetto=>Obiettivo,Descrizione,Metrica,Target | Rischi iniziali=>Rischio,Descrizione,Probabilita,Impatto,Mitigazione\n[END_DOCUMENT_TYPE_PROFILE]\n[DOMAIN_PROFILE]\nprofile_active=project_management\nprofile_active=assicurativo\nsemantic_rules=allineare obiettivi | evitare ambiguita\nrecommended_terms=milestone | stakeholder\n[END_DOMAIN_PROFILE]\n[USER_EXPLICIT_REQUIREMENTS]\nrequired_sections_from_user=Obiettivi | Rischi\n[END_USER_EXPLICIT_REQUIREMENTS]\n[OUTPUT_CONSTRAINTS]\nsingle_markdown_document=true\nno_json=true\navoid_truncated_output=true\n[END_OUTPUT_CONSTRAINTS]",
        language: "it",
        generationMode: "guided",
        syntaxProfile: {
          fieldNamePattern: "^[a-z_][a-z0-9_]*$",
          supportedTypes: ["string", "date", "list"],
          variants: [
            {
              id: "strict",
              format: "{{type:field_name}}",
              example: "{{string:n}}",
            },
          ],
        },
        syntaxSpec: {
          version: "v1",
          parserVersion: "1.0.0",
          supportedTypes: ["string", "date", "list"],
          compactGrammar: "TEMPLATE PLACEHOLDER GRAMMAR\n- {{string:nome}}",
        },
      },
      false,
    );
    expect(rawBody.prompt).toContain("TEMPLATE PLACEHOLDER GRAMMAR");
    expect(rawBody.prompt).toContain(
      "Richiesta utente molto lunga da conservare integralmente",
    );
    expect(rawBody.prompt).toContain("profile_active=project_charter");
    expect(rawBody.prompt).toContain(
      "Obiettivi del progetto=>Obiettivo,Descrizione,Metrica,Target",
    );
    expect(rawBody.prompt).toContain(
      "Rischi iniziali=>Rischio,Descrizione,Probabilita,Impatto,Mitigazione",
    );
    expect(rawBody.prompt).not.toContain("profile_active=scheda");
    expect(rawBody.prompt).not.toContain("profile_active=assicurativo");
    expect(rawBody.prompt).toContain("[END_OUTPUT_CONSTRAINTS]");
    expect(rawBody.prompt).toContain(
      "Output solo markdown completo (titolo + almeno una sezione + placeholder).",
    );
    expect(rawBody.prompt.length).toBeLessThan(nonCompactPrompt.length);
    expect(rawBody.options.num_predict).toBe(1337);
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining("compactMode=true"),
    );
  });

  it("warns and fails in controlled way when prompt still exceeds max", async () => {
    process.env.OLLAMA_COMPACT_PROMPT_CHARS = "200";
    process.env.OLLAMA_MAX_PROMPT_CHARS = "300";
    global.fetch = jest.fn() as unknown as typeof fetch;
    const provider = new OllamaAiProvider();
    const warnSpy = jest
      .spyOn(
        (provider as unknown as { logger: { warn: (msg: string) => void } })
          .logger,
        "warn",
      )
      .mockImplementation(() => undefined);
    await expect(
      provider.generateTemplateDraft({
        description: `Richiesta ${"x".repeat(2500)}\n[BACKEND_INTENT_NORMALIZATION]\ndocument_type=project_charter\ndomain=project_management\n[END_BACKEND_INTENT_NORMALIZATION]`,
        language: "it",
        generationMode: "guided",
        syntaxProfile: {
          fieldNamePattern: "^[a-z_][a-z0-9_]*$",
          supportedTypes: ["string"],
          variants: [
            {
              id: "strict",
              format: "{{type:field_name}}",
              example: "{{string:n}}",
            },
          ],
        },
      }),
    ).rejects.toThrow("Prompt budget exceeded after safe compaction");
    expect(warnSpy).toHaveBeenCalled();
  });
});
