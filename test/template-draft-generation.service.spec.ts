import { MockAiProvider } from "../src/service/ai/mock-ai.provider";
import { OllamaAiProvider } from "../src/service/ai/ollama-ai.provider";
import { TemplateAuditService } from "../src/service/template-audit.service";
import { TemplateDraftGenerationService } from "../src/service/template-draft-generation.service";
import { TemplatePlaceholderService } from "../src/service/template-placeholder.service";

describe("TemplateDraftGenerationService", () => {
  const originalProvider = process.env.AI_PROVIDER;
  const projectCharterSections = [
    "Titolo e informazioni generali del progetto",
    "Descrizione del progetto",
    "Business case o motivazione del progetto",
    "Obiettivi del progetto",
    "Benefici attesi",
    "Ambito preliminare del progetto",
    "Deliverable principali",
    "Milestone principali",
    "Stakeholder principali",
    "Ruoli e responsabilita iniziali",
    "Requisiti di alto livello",
    "Assunzioni",
    "Vincoli",
    "Rischi iniziali",
    "Budget preliminare",
    "Criteri di successo",
    "Autorita del Project Manager",
    "Approvazioni finali",
  ];
  const projectCharterTableSections = [
    "Obiettivi del progetto",
    "Benefici attesi",
    "Ambito preliminare del progetto",
    "Deliverable principali",
    "Milestone principali",
    "Stakeholder principali",
    "Ruoli e responsabilita iniziali",
    "Requisiti di alto livello",
    "Rischi iniziali",
    "Budget preliminare",
    "Autorita del Project Manager",
    "Approvazioni finali",
  ];

  function extractSection(markdown: string, title: string): string {
    const start = markdown.indexOf(`## ${title}`);
    if (start < 0) return "";
    const rest = markdown.slice(start + 1);
    const next = rest.search(/^##\s+/m);
    return next >= 0
      ? markdown.slice(start, start + 1 + next)
      : markdown.slice(start);
  }

  afterEach(() => {
    process.env.AI_PROVIDER = originalProvider;
    jest.restoreAllMocks();
  });

  it("post-processes unsupported table placeholders, accented field names and non-canonical tokens", async () => {
    class InvalidTableProvider extends MockAiProvider {
      override async generateTemplateDraft() {
        return {
          markdown: [
            "# Project Charter",
            "## Titolo e informazioni generali del progetto",
            "Unità responsabile: {{text:unità_responsabile}}",
            "## Obiettivi del progetto",
            "{{table:obiettivi:120:true}}",
            "## Rischi iniziali",
            "| Rischio | Descrizione |",
            "|---|---|",
            "| {{string:rischio_1}} | {{text:descrizione_rischio_1}} |",
            "## Milestone principali",
            "{{subtable:milestone:120:true}}",
          ].join("\n"),
          model: "invalid-table-placeholder-test",
          latencyMs: 1,
        };
      }
    }
    process.env.AI_PROVIDER = "mock";
    const placeholderService = new TemplatePlaceholderService();
    const auditService = new TemplateAuditService(placeholderService, {
      auditTemplate: jest.fn().mockResolvedValue({
        warnings: [],
        provider: "mock",
        model: "mock-semantic-rules-v1",
        latencyMs: 1,
      }),
    } as never);
    const service = new TemplateDraftGenerationService(
      placeholderService,
      auditService,
      new InvalidTableProvider(),
      new OllamaAiProvider(),
    );

    const result = await service.generateDraft({
      description: "Crea un Project Charter con obiettivi, rischi e milestone.",
      language: "it",
      runSemanticAudit: false,
    });

    expect(result.content).not.toMatch(/\{\{(?:table|subtable):/i);
    expect(result.content).not.toContain("{{text:unità_responsabile}}");
    expect(result.content).toContain("{{text:unita_responsabile:400:true}}");
    expect(result.content).toContain("{{string:obiettivo_1:120:true}}");
    expect(result.content).toContain("{{string:milestone_1:120:true}}");
    expect(result.deterministic.errors).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "UNSUPPORTED_TYPE" }),
        expect.objectContaining({ code: "INVALID_FORMAT" }),
      ]),
    );
    expect(result.content).toContain(
      "| Rischio | Descrizione | Probabilità | Impatto | Mitigazione |",
    );
  });

  it("generates a deterministic-valid markdown draft with MockAiProvider", async () => {
    process.env.AI_PROVIDER = "mock";
    const placeholderService = new TemplatePlaceholderService();
    const auditService = new TemplateAuditService(placeholderService, {
      auditTemplate: jest.fn().mockResolvedValue({
        warnings: [],
        provider: "mock",
        model: "mock-semantic-rules-v1",
        latencyMs: 1,
      }),
    } as never);

    const service = new TemplateDraftGenerationService(
      placeholderService,
      auditService,
      new MockAiProvider(),
      new OllamaAiProvider(),
    );

    const result = await service.generateDraft({
      description: "Documento cliente con dati anagrafici, importo e data.",
      language: "it",
      runSemanticAudit: false,
    });

    expect(result.content).toContain("{{");
    expect(result.deterministic.errors).not.toContainEqual(
      expect.objectContaining({ code: "UNSUPPORTED_TYPE" }),
    );
    expect(result.savable).toBe(true);
    expect(result.fields.length).toBeGreaterThan(0);
    expect(result.ai.provider).toBe("mock");
    expect(result.benchmark.syntaxSpecIncluded).toBe(true);
    expect(result.benchmark.generationMode).toBe("guided");
  });

  it("returns savable=false when provider outputs unsupported syntax", async () => {
    class InvalidSyntaxProvider extends MockAiProvider {
      override async generateTemplateDraft() {
        return {
          markdown:
            "# Documento\n\nCliente: {{string:nome_cliente:length:true:extra}}",
          model: "invalid-syntax-test",
          latencyMs: 2,
        };
      }
    }

    process.env.AI_PROVIDER = "mock";
    const placeholderService = new TemplatePlaceholderService();
    const auditService = new TemplateAuditService(placeholderService, {
      auditTemplate: jest.fn().mockResolvedValue({
        warnings: [],
        provider: "mock",
        model: "mock-semantic-rules-v1",
        latencyMs: 1,
      }),
    } as never);
    const service = new TemplateDraftGenerationService(
      placeholderService,
      auditService,
      new InvalidSyntaxProvider(),
      new OllamaAiProvider(),
    );

    const result = await service.generateDraft({
      description: "Scheda cliente minimale",
      language: "it",
      runSemanticAudit: false,
    });

    expect(result.savable).toBe(false);
    expect(result.deterministic.errors.length).toBeGreaterThan(0);
  });

  it("returns savable=false when provider outputs unsupported type", async () => {
    class InvalidTypeProvider extends MockAiProvider {
      override async generateTemplateDraft() {
        return {
          markdown: "# Documento\n\nData: {{datetime:data_documento}}",
          model: "invalid-type-test",
          latencyMs: 2,
        };
      }
    }

    process.env.AI_PROVIDER = "mock";
    const placeholderService = new TemplatePlaceholderService();
    const auditService = new TemplateAuditService(placeholderService, {
      auditTemplate: jest.fn().mockResolvedValue({
        warnings: [],
        provider: "mock",
        model: "mock-semantic-rules-v1",
        latencyMs: 1,
      }),
    } as never);
    const service = new TemplateDraftGenerationService(
      placeholderService,
      auditService,
      new InvalidTypeProvider(),
      new OllamaAiProvider(),
    );

    const result = await service.generateDraft({
      description: "Report attività mensile",
      language: "it",
      runSemanticAudit: false,
    });

    expect(result.savable).toBe(false);
    expect(result.deterministic.errors).toContainEqual(
      expect.objectContaining({ code: "UNSUPPORTED_TYPE" }),
    );
  });

  it("keeps valid list placeholders generated by the provider", async () => {
    class ListProvider extends MockAiProvider {
      override async generateTemplateDraft() {
        return {
          markdown:
            "# Documento\n\nPriorita: {{list:priorita:100:true:Priorità:bassa,media,alta}}",
          model: "list-placeholder-test",
          latencyMs: 2,
        };
      }
    }

    process.env.AI_PROVIDER = "mock";
    const placeholderService = new TemplatePlaceholderService();
    const auditService = new TemplateAuditService(placeholderService, {
      auditTemplate: jest.fn().mockResolvedValue({
        warnings: [],
        provider: "mock",
        model: "mock-semantic-rules-v1",
        latencyMs: 1,
      }),
    } as never);
    const service = new TemplateDraftGenerationService(
      placeholderService,
      auditService,
      new ListProvider(),
      new OllamaAiProvider(),
    );

    const result = await service.generateDraft({
      description: "Scheda con priorita a scelta",
      language: "it",
      runSemanticAudit: false,
    });

    expect(result.content).toContain(
      "{{list:priorita:100:true:Priorità:bassa,media,alta}}",
    );
    expect(result.content).not.toContain("{{text:priorita}}");
    expect(result.deterministic.errors).not.toContainEqual(
      expect.objectContaining({ code: "UNSUPPORTED_TYPE" }),
    );
    expect(result.fields).toContainEqual(
      expect.objectContaining({ name: "priorita", type: "list" }),
    );
  });

  it("repairs real Ollama insurance-agency draft with list length placeholders before exposing output", async () => {
    class BadInsuranceOllamaProvider extends OllamaAiProvider {
      public lastInputDescription = "";
      override async generateTemplateDraft(
        input: Parameters<OllamaAiProvider["generateTemplateDraft"]>[0],
      ) {
        this.lastInputDescription = input.description;
        if (
          input.description.includes("attempt=") ||
          input.description.includes("[RETRY_DELTA_PROMPT]")
        ) {
          return {
            markdown: [
              "# Gestione agenzia assicurativa",
              "## Dati generali dell'agenzia",
              "Informazioni sull'agenzia.",
              "{{string:nome_agenzia:120:true}}",
              "## Clienti",
              "Stato cliente: {{list:stato_cliente:100:true:Stato cliente,Attivo,Sospeso,In attesa}}",
              "## Polizze",
              "Tipologia: {{list:tipologia_polizza_1:100:true:Tipologia polizza,Auto,Casa,Vita,Salute,Azienda}}",
              "Stato polizza: {{list:stato_polizza_1:100:true:Stato polizza,Attiva,Sospesa,Scaduta}}",
              "## Scadenze e rinnovi",
              "Dettagli scadenze.",
              "{{date:data_scadenza:10:true}}",
              "## Sinistri",
              "Gestione sinistri.",
              "{{text:descrizione_sinistro:400:true}}",
              "## Documenti richiesti",
              "Elenco documenti.",
              "{{text:documenti_richiesti:400:true}}",
              "## Pagamenti e premi",
              "Gestione pagamenti.",
              "{{currency:importo_premio:12:true}}",
              "## Compagnie assicurative",
              "Dettagli compagnie.",
              "{{string:compagnia_partner:120:true}}",
              "## Comunicazioni con il cliente",
              "Contatti cliente.",
              "{{string:email_cliente:120:true}}",
              "## Stato delle pratiche",
              "Avanzamento.",
              "{{string:stato_pratica:120:true}}",
              "## Note operative",
              "Note finali.",
              "{{text:note_operative:400:false}}",
            ].join("\n"),
            model: "good-insurance-ollama",
            latencyMs: 2,
          };
        }
        return {
          markdown: [
            "# Gestione agenzia assicurativa",
            "## Contesto",
            "Sezione generica da non mantenere nel template finale.",
            "{{text:contesto_documento:400:true}}",
            "## Obiettivi",
            "{{list:obiettivi_documento:length:true:Obiettivi,Obiettivo 1,Obiettivo 2,Obiettivo 3}}",
            "## Contenuto principale",
            "{{list:regole_procedure:length:true:Regola,Procedura 1,Procedura 2,Procedura 3}}",
            "## Clienti",
            "Stato cliente: {{list:stato_cliente:length:true:Stato cliente,Attivo,Sospeso,In attesa}}",
            "## Polizze",
            "Tipologia: {{list:tipologia_polizza_1:length:true:Tipologia polizza,Auto,Casa,Vita,Salute,Azienda}}",
          ].join("\n"),
          model: "bad-insurance-ollama",
          latencyMs: 2,
        };
      }
    }

    process.env.AI_PROVIDER = "ollama";
    const placeholderService = new TemplatePlaceholderService();
    const auditService = new TemplateAuditService(placeholderService, {
      auditTemplate: jest.fn().mockResolvedValue({
        warnings: [],
        provider: "mock",
        model: "mock-semantic-rules-v1",
        latencyMs: 1,
      }),
    } as never);
    const ollamaProvider = new BadInsuranceOllamaProvider();
    const service = new TemplateDraftGenerationService(
      placeholderService,
      auditService,
      new MockAiProvider(),
      ollamaProvider,
    );

    const result = await service.generateDraft({
      description:
        "Vorrei un template per la gestione di un’agenzia assicurativa.",
      language: "it",
      runSemanticAudit: false,
    });

    expect(ollamaProvider.lastInputDescription).toContain(
      "[OFFICIAL_PLACEHOLDER_SYNTAX]",
    );
    expect(result.content).not.toContain(":length:");
    expect(result.content).not.toContain("## Contenuto principale");
    expect(result.content).not.toContain(
      "## Business case o motivazione del progetto",
    );
    expect(result.content).not.toContain("## Autorita del Project Manager");
    expect(result.content).toContain(
      "{{list:stato_polizza_1:100:true:Stato polizza,Attiva,Sospesa,Scaduta}}",
    );
    expect(result.content).toContain(
      "{{list:tipologia_polizza_1:100:true:Tipologia polizza,Auto,Casa,Vita,Salute,Azienda}}",
    );
    for (const section of [
      "Dati generali dell'agenzia",
      "Clienti",
      "Polizze",
      "Scadenze e rinnovi",
      "Sinistri",
      "Documenti richiesti",
      "Pagamenti e premi",
      "Compagnie assicurative",
      "Comunicazioni con il cliente",
      "Stato delle pratiche",
      "Note operative",
    ]) {
      expect(result.content).toContain(`## ${section}`);
    }
    expect(result.content).not.toMatch(/\{\{list:[^:}]+:[^0-9:}][^:}]*:/);
    expect(result.deterministic.errors).toEqual([]);
    expect(result.placeholderAnalysis.unsupportedTypes).toEqual([]);
    expect(result.placeholderAnalysis.duplicatedPlaceholders).toEqual([]);
    expect(result.savable).toBe(true);
  });

  it("runs semantic audit only when requested", async () => {
    process.env.AI_PROVIDER = "mock";
    const placeholderService = new TemplatePlaceholderService();
    const auditService = new TemplateAuditService(placeholderService, {
      auditTemplate: jest.fn().mockResolvedValue({
        warnings: [],
        provider: "mock",
        model: "mock-semantic-rules-v1",
        latencyMs: 1,
      }),
    } as never);
    const auditSpy = jest.spyOn(auditService, "audit");

    const service = new TemplateDraftGenerationService(
      placeholderService,
      auditService,
      new MockAiProvider(),
      new OllamaAiProvider(),
    );

    await service.generateDraft({
      description: "Verbale di riunione",
      language: "it",
      runSemanticAudit: false,
    });
    await service.generateDraft({
      description: "Verbale di riunione",
      language: "it",
      runSemanticAudit: true,
    });

    const callArgs = auditSpy.mock.calls.map((call) => call[0]);
    expect(callArgs).toEqual(
      expect.arrayContaining([expect.objectContaining({ runAi: false })]),
    );
    expect(callArgs).toEqual(
      expect.arrayContaining([expect.objectContaining({ runAi: true })]),
    );
  });

  it("post-processes generated accented field names into canonical placeholders", async () => {
    class AccentedFieldProvider extends MockAiProvider {
      override async generateTemplateDraft() {
        return {
          markdown:
            "# Documento\n\nUnità responsabile: {{string:unità_responsabile}}",
          model: "accented-field-test",
          latencyMs: 2,
        };
      }
    }

    process.env.AI_PROVIDER = "mock";
    const placeholderService = new TemplatePlaceholderService();
    const auditService = new TemplateAuditService(placeholderService, {
      auditTemplate: jest.fn().mockResolvedValue({
        warnings: [],
        provider: "mock",
        model: "mock-semantic-rules-v1",
        latencyMs: 1,
      }),
    } as never);
    const service = new TemplateDraftGenerationService(
      placeholderService,
      auditService,
      new AccentedFieldProvider(),
      new OllamaAiProvider(),
    );

    const result = await service.generateDraft({
      description: "Scheda cliente con segnaposti tecnici",
      language: "it",
      runSemanticAudit: false,
      autoRepair: true,
    });

    expect(result.savable).toBe(true);
    expect(result.content).not.toContain("{{string:unità_responsabile}}");
    expect(result.content).toContain("{{string:unita_responsabile:120:true}}");
    expect(result.repair.applied).toBe(true);
    expect(result.repair.repairAppliedCount).toBeGreaterThan(0);
  });

  it("post-processes generated placeholders even when explicit repair is disabled", async () => {
    class AccentedFieldProviderNoRepair extends MockAiProvider {
      override async generateTemplateDraft() {
        return {
          markdown: [
            "# Documento",
            "",
            "Unita: {{string:unità_responsabile}}",
            "Ruoli: {{text:ruoli_e_responsabilità}}",
            "P1: {{percentage:livello_probabilità_1}}",
            "P2: {{percentage:livello_probabilità_2}}",
          ].join("\n"),
          model: "accented-no-repair-test",
          latencyMs: 2,
        };
      }
    }

    process.env.AI_PROVIDER = "mock";
    const placeholderService = new TemplatePlaceholderService();
    const auditService = new TemplateAuditService(placeholderService, {
      auditTemplate: jest.fn().mockResolvedValue({
        warnings: [],
        provider: "mock",
        model: "mock-semantic-rules-v1",
        latencyMs: 1,
      }),
    } as never);
    const service = new TemplateDraftGenerationService(
      placeholderService,
      auditService,
      new AccentedFieldProviderNoRepair(),
      new OllamaAiProvider(),
    );

    const result = await service.generateDraft({
      description: "Template con campi accentati",
      language: "it",
      runSemanticAudit: false,
      autoRepair: false,
    });

    expect(result.content).not.toMatch(/\{\{[^{}\n]*[àèéìòù][^{}\n]*\}\}/i);
    expect(result.content).toContain("{{string:unita_responsabile:120:true}}");
    expect(result.content).toContain(
      "{{text:ruoli_e_responsabilita:400:true}}",
    );
    expect(result.content).toContain(
      "{{percentage:livello_probabilita_1:5:true}}",
    );
    expect(result.content).toContain(
      "{{percentage:livello_probabilita_2:5:true}}",
    );
    expect(result.repair.applied).toBe(true);
    expect(result.repair.repairAppliedCount).toBeGreaterThan(0);
  });

  it("post-processes accented authority placeholders into canonical ASCII names", async () => {
    class AccentedAuthorityProvider extends MockAiProvider {
      override async generateTemplateDraft() {
        return {
          markdown:
            "# Documento\n\nReferente: {{text:autorità_project_manager}}",
          model: "accented-authority-test",
          latencyMs: 2,
        };
      }
    }

    process.env.AI_PROVIDER = "mock";
    const placeholderService = new TemplatePlaceholderService();
    const auditService = new TemplateAuditService(placeholderService, {
      auditTemplate: jest.fn().mockResolvedValue({
        warnings: [],
        provider: "mock",
        model: "mock-semantic-rules-v1",
        latencyMs: 1,
      }),
    } as never);
    const service = new TemplateDraftGenerationService(
      placeholderService,
      auditService,
      new AccentedAuthorityProvider(),
      new OllamaAiProvider(),
    );

    const result = await service.generateDraft({
      description: "Scheda progetto",
      language: "it",
      runSemanticAudit: false,
      autoRepair: true,
    });

    expect(result.content).not.toContain("{{text:autorità_project_manager}}");
    expect(result.content).toContain(
      "{{text:autorita_project_manager:400:true}}",
    );
    expect(result.repair.applied).toBe(true);
    expect(result.repair.repairAppliedCount).toBeGreaterThan(0);
  });

  it("canonicalizes non numeric length during generated draft post-processing", async () => {
    class InvalidLengthProvider extends MockAiProvider {
      override async generateTemplateDraft() {
        return {
          markdown:
            "# Documento\n\nCliente: {{string:nome_cliente:length:true}}",
          model: "invalid-length-test",
          latencyMs: 2,
        };
      }
    }

    process.env.AI_PROVIDER = "mock";
    const placeholderService = new TemplatePlaceholderService();
    const auditService = new TemplateAuditService(placeholderService, {
      auditTemplate: jest.fn().mockResolvedValue({
        warnings: [],
        provider: "mock",
        model: "mock-semantic-rules-v1",
        latencyMs: 1,
      }),
    } as never);
    const service = new TemplateDraftGenerationService(
      placeholderService,
      auditService,
      new InvalidLengthProvider(),
      new OllamaAiProvider(),
    );

    const result = await service.generateDraft({
      description: "Template tecnico con max length",
      language: "it",
      runSemanticAudit: false,
      autoRepair: true,
      defaultLength: 120,
    });

    expect(result.savable).toBe(true);
    expect(result.content).not.toContain("{{string:nome_cliente:length:true}}");
    expect(result.content).toContain("{{string:nome_cliente:120:true}}");
    expect(result.repair.applied).toBe(true);
    expect(result.repair.repairAppliedCount).toBeGreaterThan(0);
  });

  it("reports repairable errors available when autoRepair is disabled", async () => {
    class RepairableButDisabledProvider extends MockAiProvider {
      override async generateTemplateDraft() {
        return {
          markdown:
            "# Documento\n\nObiettivi: {{list:obiettivi:length:true:obiettivi}}",
          model: "repairable-disabled-test",
          latencyMs: 2,
        };
      }
    }

    process.env.AI_PROVIDER = "mock";
    const placeholderService = new TemplatePlaceholderService();
    const auditService = new TemplateAuditService(placeholderService, {
      auditTemplate: jest.fn().mockResolvedValue({
        warnings: [],
        provider: "mock",
        model: "mock-semantic-rules-v1",
        latencyMs: 1,
      }),
    } as never);
    const service = new TemplateDraftGenerationService(
      placeholderService,
      auditService,
      new RepairableButDisabledProvider(),
      new OllamaAiProvider(),
    );

    const result = await service.generateDraft({
      description: "Template con lista",
      language: "it",
      runSemanticAudit: false,
      autoRepair: false,
      defaultLength: 100,
    });

    expect(result.repair.applied).toBe(false);
    expect(result.placeholderAnalysis.repairableErrorsAvailable).toBe(false);
    expect(result.placeholderAnalysis.repairApplied).toBe(false);
    expect(result.placeholderAnalysis.blockingErrorsAfterRepair).toBe(1);
  });

  it("fails when technical placeholders are explicitly forbidden by prompt", async () => {
    process.env.AI_PROVIDER = "mock";
    const placeholderService = new TemplatePlaceholderService();
    const auditService = new TemplateAuditService(placeholderService, {
      auditTemplate: jest.fn().mockResolvedValue({
        warnings: [],
        provider: "mock",
        model: "mock-semantic-rules-v1",
        latencyMs: 1,
      }),
    } as never);
    const service = new TemplateDraftGenerationService(
      placeholderService,
      auditService,
      new MockAiProvider(),
      new OllamaAiProvider(),
    );

    const result = await service.generateDraft({
      description:
        "Genera un testo con segnaposto semplici e non usare placeholder tecnici.",
      language: "it",
      runSemanticAudit: false,
    });

    expect(result.savable).toBe(false);
    expect(result.evaluation.promptConformity.valid).toBe(false);
  });

  it("supports free mode without syntax spec in prompt metadata", async () => {
    process.env.AI_PROVIDER = "mock";
    const placeholderService = new TemplatePlaceholderService();
    const auditService = new TemplateAuditService(placeholderService, {
      auditTemplate: jest.fn().mockResolvedValue({
        warnings: [],
        provider: "mock",
        model: "mock-semantic-rules-v1",
        latencyMs: 1,
      }),
    } as never);
    const service = new TemplateDraftGenerationService(
      placeholderService,
      auditService,
      new MockAiProvider(),
      new OllamaAiProvider(),
    );

    const result = await service.generateDraft({
      description: "Genera una bozza libera.",
      language: "it",
      runSemanticAudit: false,
      generationMode: "free",
    });

    expect(result.benchmark.syntaxSpecIncluded).toBe(true);
    expect(result.benchmark.generationMode).toBe("free");
  });

  it("generates guided Project Charter and completes missing canonical sections", async () => {
    process.env.AI_PROVIDER = "mock";
    const placeholderService = new TemplatePlaceholderService();
    const auditService = new TemplateAuditService(placeholderService, {
      auditTemplate: jest.fn().mockResolvedValue({
        warnings: [],
        provider: "mock",
        model: "mock-semantic-rules-v1",
        latencyMs: 1,
      }),
    } as never);
    const service = new TemplateDraftGenerationService(
      placeholderService,
      auditService,
      new MockAiProvider(),
      new OllamaAiProvider(),
    );

    const result = await service.generateDraft({
      description: "Project Charter per nuovo programma digitale",
      language: "it",
      runSemanticAudit: false,
    });

    expect(result.savable).toBe(true);
    expect(result.content).toContain("## Assunzioni");
    expect(result.content).toContain("## Vincoli");
    expect(result.content).toContain("## Rischi iniziali");
    expect(result.content).toContain("## Budget preliminare");
    expect(result.content).toContain("## Criteri di successo");
    expect(result.content).toContain("## Autorita del Project Manager");
    expect(result.content).toContain("## Approvazioni finali");
    expect(result.content).toContain(
      "{{string:ambito_decisionale_1:120:true}}",
    );
    expect(result.content).not.toContain("{{string:nome_authorita}}");
    expect(result.deterministic.warnings).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "MISSING_REQUIRED_SECTION" }),
      ]),
    );
  });

  it("generates Project Charter sections once in canonical order with required tables", async () => {
    process.env.AI_PROVIDER = "mock";
    const placeholderService = new TemplatePlaceholderService();
    const auditService = new TemplateAuditService(placeholderService, {
      auditTemplate: jest.fn().mockResolvedValue({
        warnings: [],
        provider: "mock",
        model: "mock-semantic-rules-v1",
        latencyMs: 1,
      }),
    } as never);
    const service = new TemplateDraftGenerationService(
      placeholderService,
      auditService,
      new MockAiProvider(),
      new OllamaAiProvider(),
    );

    const result = await service.generateDraft({
      description:
        "Genera un Project Charter professionale completo per un nuovo programma digitale.",
      language: "it",
      runSemanticAudit: false,
    });

    for (const section of projectCharterSections) {
      const heading = `## ${section}`;
      const firstIndex = result.content.indexOf(heading);
      expect(firstIndex).toBeGreaterThan(-1);
      expect(result.content.indexOf(heading, firstIndex + heading.length)).toBe(
        -1,
      );
    }
    for (const section of projectCharterTableSections) {
      const body = extractSection(result.content, section);
      expect(body).toContain("|");
      expect(body).toContain("|---");
    }
    expect(result.content).toContain("## Requisiti di alto livello");
    expect(result.deterministic.errors).toEqual([]);
    expect(result.savable).toBe(true);
  });

  it("removes duplicated Project Charter title section and keeps a single H1", async () => {
    class DuplicatedTitleProvider extends MockAiProvider {
      override async generateTemplateDraft() {
        return {
          markdown: [
            "# Project Charter",
            "## Project Charter",
            "Titolo duplicato non ammesso.",
            "## Obiettivi del progetto",
            "{{text:obiettivi_progetto}}",
          ].join("\n"),
          model: "duplicated-title-provider",
          latencyMs: 2,
        };
      }
    }
    process.env.AI_PROVIDER = "mock";
    const placeholderService = new TemplatePlaceholderService();
    const auditService = new TemplateAuditService(placeholderService, {
      auditTemplate: jest.fn().mockResolvedValue({
        warnings: [],
        provider: "mock",
        model: "mock-semantic-rules-v1",
        latencyMs: 1,
      }),
    } as never);
    const service = new TemplateDraftGenerationService(
      placeholderService,
      auditService,
      new DuplicatedTitleProvider(),
      new OllamaAiProvider(),
    );

    const result = await service.generateDraft({
      description: "Project Charter di test",
      language: "it",
      runSemanticAudit: false,
    });

    expect(result.content.match(/^#\s+Project Charter$/gm)?.length).toBe(1);
    expect(result.content).not.toContain("\n## Project Charter\n");
  });

  it("keeps generated narrative readable and placeholder names canonical", async () => {
    process.env.AI_PROVIDER = "mock";
    const placeholderService = new TemplatePlaceholderService();
    const auditService = new TemplateAuditService(placeholderService, {
      auditTemplate: jest.fn().mockResolvedValue({
        warnings: [],
        provider: "mock",
        model: "mock-semantic-rules-v1",
        latencyMs: 1,
      }),
    } as never);
    const service = new TemplateDraftGenerationService(
      placeholderService,
      auditService,
      new MockAiProvider(),
      new OllamaAiProvider(),
    );
    const result = await service.generateDraft({
      description: "Genera un Project Charter completo",
      language: "it",
      runSemanticAudit: false,
    });
    expect(result.content).toContain("opportunita");
    expect(result.content).toContain("perche");
    expect(result.content).not.toMatch(/\{\{[^{}\n]*[àèéìòù][^{}\n]*\}\}/i);
  });

  it("does not force Project Charter sections for verbale requests", async () => {
    process.env.AI_PROVIDER = "mock";
    const placeholderService = new TemplatePlaceholderService();
    const auditService = new TemplateAuditService(placeholderService, {
      auditTemplate: jest.fn().mockResolvedValue({
        warnings: [],
        provider: "mock",
        model: "mock-semantic-rules-v1",
        latencyMs: 1,
      }),
    } as never);
    const service = new TemplateDraftGenerationService(
      placeholderService,
      auditService,
      new MockAiProvider(),
      new OllamaAiProvider(),
    );

    const result = await service.generateDraft({
      description:
        "Genera un verbale di riunione con partecipanti, decisioni e azioni.",
      language: "it",
      runSemanticAudit: false,
    });

    expect(result.content).toContain("## Riunione");
    expect(result.content).not.toContain("## Requisiti di alto livello");
    expect(result.content).not.toContain("## Approvazioni finali");
  });

  it("does not force Project Charter sections for capitolato requests", async () => {
    process.env.AI_PROVIDER = "mock";
    const placeholderService = new TemplatePlaceholderService();
    const auditService = new TemplateAuditService(placeholderService, {
      auditTemplate: jest.fn().mockResolvedValue({
        warnings: [],
        provider: "mock",
        model: "mock-semantic-rules-v1",
        latencyMs: 1,
      }),
    } as never);
    const service = new TemplateDraftGenerationService(
      placeholderService,
      auditService,
      new MockAiProvider(),
      new OllamaAiProvider(),
    );

    const result = await service.generateDraft({
      description:
        "Genera un capitolato tecnico per fornitura software con requisiti e SLA.",
      language: "it",
      runSemanticAudit: false,
    });

    expect(result.content).toContain("## Contratto");
    expect(result.content).not.toContain("## Requisiti di alto livello");
    expect(result.content).not.toContain("## Autorita del Project Manager");
  });

  it("generates a coherent report structure for report requests", async () => {
    process.env.AI_PROVIDER = "mock";
    const placeholderService = new TemplatePlaceholderService();
    const auditService = new TemplateAuditService(placeholderService, {
      auditTemplate: jest.fn().mockResolvedValue({
        warnings: [],
        provider: "mock",
        model: "mock-semantic-rules-v1",
        latencyMs: 1,
      }),
    } as never);
    const service = new TemplateDraftGenerationService(
      placeholderService,
      auditService,
      new MockAiProvider(),
      new OllamaAiProvider(),
    );

    const result = await service.generateDraft({
      description: "Genera un report mensile con dati principali e analisi.",
      language: "it",
      runSemanticAudit: false,
    });

    expect(result.content).toContain("## Report mensile");
    expect(result.content).toContain("{{");
    expect(result.content).not.toContain("## Approvazioni finali");
  });

  it("generates valid markdown for unknown document types without forcing Project Charter", async () => {
    process.env.AI_PROVIDER = "mock";
    const placeholderService = new TemplatePlaceholderService();
    const auditService = new TemplateAuditService(placeholderService, {
      auditTemplate: jest.fn().mockResolvedValue({
        warnings: [],
        provider: "mock",
        model: "mock-semantic-rules-v1",
        latencyMs: 1,
      }),
    } as never);
    const service = new TemplateDraftGenerationService(
      placeholderService,
      auditService,
      new MockAiProvider(),
      new OllamaAiProvider(),
    );

    const result = await service.generateDraft({
      description:
        "Genera un documento professionale per onboarding partner esterni.",
      language: "it",
      runSemanticAudit: false,
    });

    expect(result.content.trim().startsWith("# ")).toBe(true);
    expect(result.content).toContain("{{");
    expect(result.content).not.toContain(
      "## Titolo e informazioni generali del progetto",
    );
  });

  it("keeps unsafely repairable output as invalid", async () => {
    class UnsafeProvider extends MockAiProvider {
      override async generateTemplateDraft() {
        return {
          markdown: "# Documento\n\nCliente: {{string::true}}",
          model: "unsafe-repair-test",
          latencyMs: 2,
        };
      }
    }

    process.env.AI_PROVIDER = "mock";
    const placeholderService = new TemplatePlaceholderService();
    const auditService = new TemplateAuditService(placeholderService, {
      auditTemplate: jest.fn().mockResolvedValue({
        warnings: [],
        provider: "mock",
        model: "mock-semantic-rules-v1",
        latencyMs: 1,
      }),
    } as never);
    const service = new TemplateDraftGenerationService(
      placeholderService,
      auditService,
      new UnsafeProvider(),
      new OllamaAiProvider(),
    );

    const result = await service.generateDraft({
      description: "Template con errore non riparabile",
      language: "it",
      runSemanticAudit: false,
      autoRepair: true,
    });

    expect(result.savable).toBe(false);
    expect(result.repair.applied).toBe(false);
  });

  it("repairs accented field + descriptive list length by converting list to text", async () => {
    process.env.AI_PROVIDER = "mock";
    const placeholderService = new TemplatePlaceholderService();
    const auditService = new TemplateAuditService(placeholderService, {
      auditTemplate: jest.fn().mockResolvedValue({
        warnings: [],
        provider: "mock",
        model: "mock-semantic-rules-v1",
        latencyMs: 1,
      }),
    } as never);
    const service = new TemplateDraftGenerationService(
      placeholderService,
      auditService,
      new MockAiProvider(),
      new OllamaAiProvider(),
    );

    const result = await service.repairDraft({
      content:
        "{{string:unità_responsabile}}\n{{list:obiettivi:length:true:obiettivi}}",
      defaultLength: 100,
      generationMode: "guided",
      runSemanticAudit: false,
    });

    expect(result.content).toContain("{{string:unita_responsabile:120:true}}");
    expect(result.content).toContain("{{text:obiettivi:400:true}}");
    expect(result.content).not.toContain(
      "{{list:obiettivi:length:true:obiettivi}}",
    );
    expect(result.repair.repairAppliedCount).toBeGreaterThan(0);
    expect(result.repair.finalValidationPassed).toBe(false);
    expect(result.savable).toBe(false);
    expect(result.repair.blockingErrorsAfterRepair).toBe(0);
  });

  it("repairs unsupported table placeholders into markdown content and counts the change", async () => {
    process.env.AI_PROVIDER = "mock";
    const placeholderService = new TemplatePlaceholderService();
    const auditService = new TemplateAuditService(placeholderService, {
      auditTemplate: jest.fn().mockResolvedValue({
        warnings: [],
        provider: "mock",
        model: "mock-semantic-rules-v1",
        latencyMs: 1,
      }),
    } as never);
    const service = new TemplateDraftGenerationService(
      placeholderService,
      auditService,
      new MockAiProvider(),
      new OllamaAiProvider(),
    );

    const result = await service.repairDraft({
      content: "## Obiettivi\n{{table:obiettivi:120:true}}",
      defaultLength: 100,
      generationMode: "guided",
      runSemanticAudit: false,
    });

    expect(result.content).not.toContain("{{table:");
    expect(result.content).toContain("| Voce | Valore |");
    expect(result.content).toContain("{{string:obiettivi_1:120:true}}");
    expect(result.repair.applied).toBe(true);
    expect(result.repair.repairAppliedCount).toBeGreaterThan(0);
  });

  it("returns canonical repaired placeholders so the editor can replace invalid content safely", async () => {
    process.env.AI_PROVIDER = "mock";
    const placeholderService = new TemplatePlaceholderService();
    const auditService = new TemplateAuditService(placeholderService, {
      auditTemplate: jest.fn().mockResolvedValue({
        warnings: [],
        provider: "mock",
        model: "mock-semantic-rules-v1",
        latencyMs: 1,
      }),
    } as never);
    const service = new TemplateDraftGenerationService(
      placeholderService,
      auditService,
      new MockAiProvider(),
      new OllamaAiProvider(),
    );

    const result = await service.repairDraft({
      content: "{{string:unit\u00e0_responsabile}}\n{{text:obiettivi}}",
      defaultLength: 100,
      generationMode: "guided",
      runSemanticAudit: false,
    });

    expect(result.content).toContain("{{string:unita_responsabile:120:true}}");
    expect(result.content).toContain("{{text:obiettivi:400:true}}");
    expect(result.repair.applied).toBe(true);
    expect(result.repair.repairAppliedCount).toBeGreaterThan(0);
  });

  it("marks temporary list values as review-required when repairing non-descriptive list", async () => {
    process.env.AI_PROVIDER = "mock";
    const placeholderService = new TemplatePlaceholderService();
    const auditService = new TemplateAuditService(placeholderService, {
      auditTemplate: jest.fn().mockResolvedValue({
        warnings: [],
        provider: "mock",
        model: "mock-semantic-rules-v1",
        latencyMs: 1,
      }),
    } as never);
    const service = new TemplateDraftGenerationService(
      placeholderService,
      auditService,
      new MockAiProvider(),
      new OllamaAiProvider(),
    );

    const result = await service.repairDraft({
      content: "{{list:stato_approvazione:length:true:stati}}",
      defaultLength: 100,
      generationMode: "guided",
      runSemanticAudit: false,
    });

    expect(result.content).toContain(
      "{{list:stato_approvazione:100:true:stati,Opzione1,Opzione2,Opzione3}}",
    );
    expect(result.repair.changes).toEqual(
      expect.arrayContaining([
        "review_required:list_values_temporary",
        expect.stringContaining("list_values:temporary->"),
      ]),
    );
    expect(
      result.evaluation.promptConformity.issues.some((issue) =>
        issue.includes("list values temporanei inseriti automaticamente"),
      ),
    ).toBe(true);
  });

  it("does not call AI generation provider during deterministic safe repair", async () => {
    process.env.AI_PROVIDER = "ollama";
    const placeholderService = new TemplatePlaceholderService();
    const auditService = new TemplateAuditService(placeholderService, {
      auditTemplate: jest.fn().mockResolvedValue({
        warnings: [],
        provider: "mock",
        model: "mock-semantic-rules-v1",
        latencyMs: 1,
      }),
    } as never);
    const ollamaProvider = new OllamaAiProvider();
    const draftSpy = jest.spyOn(ollamaProvider, "generateTemplateDraft");
    const auditSpy = jest.spyOn(ollamaProvider, "analyzeTemplate");
    const service = new TemplateDraftGenerationService(
      placeholderService,
      auditService,
      new MockAiProvider(),
      ollamaProvider,
    );

    await service.repairDraft({
      content: "{{string:unità_responsabile}}",
      generationMode: "guided",
      runSemanticAudit: false,
    });

    expect(draftSpy).not.toHaveBeenCalled();
    expect(auditSpy).not.toHaveBeenCalled();
  });

  it("repairs placeholder-only markdown title into static heading plus body placeholder", async () => {
    process.env.AI_PROVIDER = "mock";
    const placeholderService = new TemplatePlaceholderService();
    const auditService = new TemplateAuditService(placeholderService, {
      auditTemplate: jest.fn().mockResolvedValue({
        warnings: [],
        provider: "mock",
        model: "mock-semantic-rules-v1",
        latencyMs: 1,
      }),
    } as never);
    const service = new TemplateDraftGenerationService(
      placeholderService,
      auditService,
      new MockAiProvider(),
      new OllamaAiProvider(),
    );

    const result = await service.repairDraft({
      content: "### {{text:descrizione_progetto}}",
      generationMode: "guided",
      runSemanticAudit: false,
    });

    expect(result.content).toContain("### Descrizione Progetto");
    expect(result.content).toContain("{{text:descrizione_progetto:400:true}}");
    expect(result.repair.changes).toEqual(
      expect.arrayContaining([
        expect.stringContaining("title_placeholder:descrizione_progetto"),
      ]),
    );
  });

  it("reports SECTION_DESCRIPTION_MISSING when placeholders appear before descriptive text", async () => {
    class MissingDescriptionProvider extends MockAiProvider {
      override async generateTemplateDraft() {
        return {
          markdown: "### Descrizione progetto\n{{text:descrizione_progetto}}",
          model: "missing-description-test",
          latencyMs: 2,
        };
      }
    }
    process.env.AI_PROVIDER = "mock";
    const placeholderService = new TemplatePlaceholderService();
    const auditService = new TemplateAuditService(placeholderService, {
      auditTemplate: jest.fn().mockResolvedValue({
        warnings: [],
        provider: "mock",
        model: "mock-semantic-rules-v1",
        latencyMs: 1,
      }),
    } as never);
    const service = new TemplateDraftGenerationService(
      placeholderService,
      auditService,
      new MissingDescriptionProvider(),
      new OllamaAiProvider(),
    );

    const result = await service.generateDraft({
      description: "Template progetto",
      language: "it",
      runSemanticAudit: false,
    });

    expect(result.evaluation.didacticQuality.valid).toBe(false);
    expect(
      result.evaluation.didacticQuality.issues.some((issue) =>
        issue.startsWith("SECTION_DESCRIPTION_MISSING:"),
      ),
    ).toBe(true);
    expect(
      result.placeholderAnalysis.sectionsMissingDescription,
    ).toBeGreaterThan(0);
  });

  it("reports EXTRA_OUTPUT when final note outside template is present", async () => {
    class ExtraOutputProvider extends MockAiProvider {
      override async generateTemplateDraft() {
        return {
          markdown:
            "### Sezione\nDescrizione testuale valida della sezione.\n{{text:campo}}\n\nQuesto template e progettato per essere riutilizzato.",
          model: "extra-output-test",
          latencyMs: 2,
        };
      }
    }
    process.env.AI_PROVIDER = "mock";
    const placeholderService = new TemplatePlaceholderService();
    const auditService = new TemplateAuditService(placeholderService, {
      auditTemplate: jest.fn().mockResolvedValue({
        warnings: [],
        provider: "mock",
        model: "mock-semantic-rules-v1",
        latencyMs: 1,
      }),
    } as never);
    const service = new TemplateDraftGenerationService(
      placeholderService,
      auditService,
      new ExtraOutputProvider(),
      new OllamaAiProvider(),
    );

    const result = await service.generateDraft({
      description: "Template progetto",
      language: "it",
      runSemanticAudit: false,
    });
    expect(result.evaluation.promptConformity.valid).toBe(false);
    expect(result.evaluation.promptConformity.issues).toContain(
      "EXTRA_OUTPUT: testo extra fuori dal template rilevato (nota finale non consentita).",
    );
  });

  it("scores didactic quality as valid for concrete section description", async () => {
    class ValidDidacticProvider extends MockAiProvider {
      override async generateTemplateDraft() {
        return {
          markdown: [
            "# Project Charter",
            "### Obiettivi",
            "In questa sezione vanno inseriti obiettivi misurabili e verificabili del progetto.",
            "Queste informazioni aiutano sponsor e project manager ad allineare priorita, successo atteso e criteri di accettazione.",
            "Specificare indicatori, orizzonte temporale e vincoli principali.",
            "{{text:obiettivi_progetto}}",
          ].join("\n"),
          model: "valid-didactic-test",
          latencyMs: 2,
        };
      }
    }
    process.env.AI_PROVIDER = "mock";
    const placeholderService = new TemplatePlaceholderService();
    const auditService = new TemplateAuditService(placeholderService, {
      auditTemplate: jest.fn().mockResolvedValue({
        warnings: [],
        provider: "mock",
        model: "mock-semantic-rules-v1",
        latencyMs: 1,
      }),
    } as never);
    const service = new TemplateDraftGenerationService(
      placeholderService,
      auditService,
      new ValidDidacticProvider(),
      new OllamaAiProvider(),
    );
    const result = await service.generateDraft({
      description: "Template didattico generico",
      language: "it",
      runSemanticAudit: false,
    });
    expect(result.placeholderAnalysis.sectionsWithDescription).toBeGreaterThan(
      0,
    );
    expect(
      result.evaluation.didacticQuality.issues.some((issue) =>
        issue.includes('SECTION_DESCRIPTION_TOO_GENERIC: sezione "Obiettivi"'),
      ),
    ).toBe(false);
  });

  it("detects SECTION_DESCRIPTION_TOO_GENERIC for generic didactic text", async () => {
    class GenericDidacticProvider extends MockAiProvider {
      override async generateTemplateDraft() {
        return {
          markdown: [
            "# Project Charter",
            "### Benefici attesi",
            "Breve descrizione discorsiva del contesto e dell'obiettivo del progetto.",
            "{{text:benefici_attesi}}",
          ].join("\n"),
          model: "generic-didactic-test",
          latencyMs: 2,
        };
      }
    }
    process.env.AI_PROVIDER = "mock";
    const placeholderService = new TemplatePlaceholderService();
    const auditService = new TemplateAuditService(placeholderService, {
      auditTemplate: jest.fn().mockResolvedValue({
        warnings: [],
        provider: "mock",
        model: "mock-semantic-rules-v1",
        latencyMs: 1,
      }),
    } as never);
    const service = new TemplateDraftGenerationService(
      placeholderService,
      auditService,
      new GenericDidacticProvider(),
      new OllamaAiProvider(),
    );
    const result = await service.generateDraft({
      description: "Template charter",
      language: "it",
      runSemanticAudit: false,
    });
    expect(
      result.evaluation.didacticQuality.issues.some((issue) =>
        issue.startsWith("SECTION_DESCRIPTION_TOO_GENERIC:"),
      ),
    ).toBe(true);
    expect(result.placeholderAnalysis.genericDescriptionsCount).toBeGreaterThan(
      0,
    );
  });

  it("detects didactic issues when section has only placeholder", async () => {
    class PlaceholderOnlySectionProvider extends MockAiProvider {
      override async generateTemplateDraft() {
        return {
          markdown: [
            "# Project Charter",
            "### Ambito",
            "{{text:ambito_progetto}}",
          ].join("\n"),
          model: "placeholder-only-section-test",
          latencyMs: 2,
        };
      }
    }
    process.env.AI_PROVIDER = "mock";
    const placeholderService = new TemplatePlaceholderService();
    const auditService = new TemplateAuditService(placeholderService, {
      auditTemplate: jest.fn().mockResolvedValue({
        warnings: [],
        provider: "mock",
        model: "mock-semantic-rules-v1",
        latencyMs: 1,
      }),
    } as never);
    const service = new TemplateDraftGenerationService(
      placeholderService,
      auditService,
      new PlaceholderOnlySectionProvider(),
      new OllamaAiProvider(),
    );
    const result = await service.generateDraft({
      description: "Template charter",
      language: "it",
      runSemanticAudit: false,
    });
    expect(
      result.placeholderAnalysis.sectionsMissingDescription,
    ).toBeGreaterThan(0);
    expect(
      result.evaluation.didacticQuality.issues.some((issue) =>
        issue.startsWith("PROMPT_CONFORMITY_WARNING:"),
      ),
    ).toBe(true);
  });

  it("does not add semantic warnings for generic descriptions when semantic review is disabled", async () => {
    class GenericNoSemanticProvider extends MockAiProvider {
      override async generateTemplateDraft() {
        return {
          markdown: [
            "# Project Charter",
            "### Benefici attesi",
            "Breve descrizione del contesto e dell'obiettivo della sezione.",
            "{{text:benefici_attesi}}",
          ].join("\n"),
          model: "generic-no-semantic-test",
          latencyMs: 2,
        };
      }
    }
    process.env.AI_PROVIDER = "mock";
    const placeholderService = new TemplatePlaceholderService();
    const auditService = new TemplateAuditService(placeholderService, {
      auditTemplate: jest.fn().mockResolvedValue({
        warnings: [],
        provider: "mock",
        model: "mock-semantic-rules-v1",
        latencyMs: 1,
      }),
    } as never);
    const service = new TemplateDraftGenerationService(
      placeholderService,
      auditService,
      new GenericNoSemanticProvider(),
      new OllamaAiProvider(),
    );
    const result = await service.generateDraft({
      description: "Template charter",
      language: "it",
      runSemanticAudit: false,
    });
    expect(result.semanticAudit.warnings).toEqual([]);
    expect(result.savable).toBe(true);
  });

  it("adds semantic warnings for generic descriptions when semantic review is enabled", async () => {
    class GenericSemanticProvider extends MockAiProvider {
      override async generateTemplateDraft() {
        return {
          markdown: [
            "# Project Charter",
            "### Benefici attesi",
            "Breve descrizione del contesto e dell'obiettivo della sezione.",
            "{{text:benefici_attesi}}",
          ].join("\n"),
          model: "generic-semantic-test",
          latencyMs: 2,
        };
      }
    }
    process.env.AI_PROVIDER = "mock";
    const placeholderService = new TemplatePlaceholderService();
    const auditService = new TemplateAuditService(placeholderService, {
      auditTemplate: jest.fn().mockResolvedValue({
        warnings: [],
        provider: "mock",
        model: "mock-semantic-rules-v1",
        latencyMs: 1,
      }),
    } as never);
    const service = new TemplateDraftGenerationService(
      placeholderService,
      auditService,
      new GenericSemanticProvider(),
      new OllamaAiProvider(),
    );
    const result = await service.generateDraft({
      description: "Template charter",
      language: "it",
      runSemanticAudit: true,
    });
    expect(
      result.semanticAudit.warnings.some((warning) =>
        warning.reason.startsWith("SECTION_DESCRIPTION_TOO_GENERIC:"),
      ),
    ).toBe(true);
  });

  it("marks didacticQuality as low on mostly generic/missing section descriptions", async () => {
    class LowDidacticProvider extends MockAiProvider {
      override async generateTemplateDraft() {
        return {
          markdown: [
            "# Project Charter",
            "### Obiettivi",
            "Descrivere il progetto in modo sintetico.",
            "{{text:obiettivi}}",
            "### Rischi",
            "{{text:rischi_principali}}",
          ].join("\n"),
          model: "low-didactic-test",
          latencyMs: 2,
        };
      }
    }
    process.env.AI_PROVIDER = "mock";
    const placeholderService = new TemplatePlaceholderService();
    const auditService = new TemplateAuditService(placeholderService, {
      auditTemplate: jest.fn().mockResolvedValue({
        warnings: [],
        provider: "mock",
        model: "mock-semantic-rules-v1",
        latencyMs: 1,
      }),
    } as never);
    const service = new TemplateDraftGenerationService(
      placeholderService,
      auditService,
      new LowDidacticProvider(),
      new OllamaAiProvider(),
    );
    const result = await service.generateDraft({
      description: "Template charter",
      language: "it",
      runSemanticAudit: false,
    });
    expect(result.evaluation.didacticQuality.valid).toBe(false);
    expect(result.evaluation.didacticQuality.score).toBeLessThan(70);
    expect(result.placeholderAnalysis.didacticQualityScore).toBeLessThan(70);
  });

  it("supports natural discursive healthcare prompt with coherent sections and valid placeholders", async () => {
    process.env.AI_PROVIDER = "mock";
    const placeholderService = new TemplatePlaceholderService();
    const auditService = new TemplateAuditService(placeholderService, {
      auditTemplate: jest.fn().mockResolvedValue({
        warnings: [],
        provider: "mock",
        model: "mock-semantic-rules-v1",
        latencyMs: 1,
      }),
    } as never);
    const service = new TemplateDraftGenerationService(
      placeholderService,
      auditService,
      new MockAiProvider(),
      new OllamaAiProvider(),
    );

    const result = await service.generateDraft({
      description:
        "Genera un documento per un sistema di assistenza sanitaria che riguardi dottori, infermieri e personale sanitario. Deve descrivere responsabilita, doveri e regole da seguire.",
      language: "it",
      runSemanticAudit: false,
    });

    expect(result.content).toContain("## Ruoli e responsabilita");
    expect(result.content).toContain("## Doveri e regole da seguire");
    expect(result.content).toContain(
      "{{string:responsabile_clinico:120:true}}",
    );
    expect(result.content).not.toMatch(/\{\{[^{}\n]*[àèéìòù][^{}\n]*\}\}/i);
    expect(result.deterministic.warnings).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "PLACEHOLDER_IN_TITLE" }),
      ]),
    );
  });

  it("supports natural emergency operations prompt and keeps deterministic validation path", async () => {
    process.env.AI_PROVIDER = "mock";
    const placeholderService = new TemplatePlaceholderService();
    const auditService = new TemplateAuditService(placeholderService, {
      auditTemplate: jest.fn().mockResolvedValue({
        warnings: [],
        provider: "mock",
        model: "mock-semantic-rules-v1",
        latencyMs: 1,
      }),
    } as never);
    const service = new TemplateDraftGenerationService(
      placeholderService,
      auditService,
      new MockAiProvider(),
      new OllamaAiProvider(),
    );

    const result = await service.generateDraft({
      description:
        "Scrivi un piano operativo per la gestione delle emergenze in reparto ospedaliero, con responsabilita, procedure e comunicazioni.",
      language: "it",
      runSemanticAudit: false,
    });

    expect(result.content).toContain("## Gestione emergenze");
    expect(result.content).toContain("{{text:procedure_emergenza:400:true}}");
    expect(result.repair.applied).toBe(true);
    expect(result.placeholderAnalysis.repairApplied).toBe(true);
  });

  it("reports duplicated field and redundant declaration warnings", async () => {
    class RedundantFieldsProvider extends MockAiProvider {
      override async generateTemplateDraft() {
        return {
          markdown: [
            "# Project Charter",
            "## Ambito",
            "Descrizione operativa per compilare la sezione ambito.",
            "Serve a chiarire confini, inclusioni e responsabilita per gli stakeholder.",
            "{{text:ambito_preliminare}}",
            "## Campi compilabili",
            "- {{text:ambito_preliminare}}",
          ].join("\n"),
          model: "redundant-fields-test",
          latencyMs: 2,
        };
      }
    }
    process.env.AI_PROVIDER = "mock";
    const placeholderService = new TemplatePlaceholderService();
    const auditService = new TemplateAuditService(placeholderService, {
      auditTemplate: jest.fn().mockResolvedValue({
        warnings: [],
        provider: "mock",
        model: "mock-semantic-rules-v1",
        latencyMs: 1,
      }),
    } as never);
    const service = new TemplateDraftGenerationService(
      placeholderService,
      auditService,
      new RedundantFieldsProvider(),
      new OllamaAiProvider(),
    );
    const result = await service.generateDraft({
      description: "Template charter",
      language: "it",
      runSemanticAudit: false,
    });
    expect(result.deterministic.errors).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "DUPLICATED_FIELD",
          fieldName: "ambito_preliminare",
        }),
      ]),
    );
    expect(result.repair.changes).toEqual(
      expect.arrayContaining([
        expect.stringContaining("duplicate_field:ambito_preliminare->"),
      ]),
    );
  });

  it("auto-completes incomplete Project Charter instead of failing required-section checks", async () => {
    class IncompleteCharterProvider extends MockAiProvider {
      override async generateTemplateDraft() {
        return {
          markdown: [
            "# Project Charter",
            "## Obiettivi del progetto",
            "Questa sezione chiarisce cosa inserire, perche conta e quali indicatori usare.",
            "Serve ad allineare sponsor e project manager sui risultati attesi.",
            "{{text:obiettivi_progetto}}",
          ].join("\n"),
          model: "incomplete-charter-test",
          latencyMs: 2,
        };
      }
    }
    process.env.AI_PROVIDER = "mock";
    const placeholderService = new TemplatePlaceholderService();
    const auditService = new TemplateAuditService(placeholderService, {
      auditTemplate: jest.fn().mockResolvedValue({
        warnings: [],
        provider: "mock",
        model: "mock-semantic-rules-v1",
        latencyMs: 1,
      }),
    } as never);
    const service = new TemplateDraftGenerationService(
      placeholderService,
      auditService,
      new IncompleteCharterProvider(),
      new OllamaAiProvider(),
    );
    const result = await service.generateDraft({
      description: "Project Charter",
      language: "it",
      runSemanticAudit: false,
    });
    expect(result.deterministic.errors).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "MISSING_REQUIRED_SECTION" }),
      ]),
    );
    expect(result.savable).toBe(true);
  });

  it("completes Project Charter mandatory sections for natural prompt with ollama provider", async () => {
    class MinimalOllamaProvider extends OllamaAiProvider {
      override async generateTemplateDraft() {
        return {
          markdown: [
            "# Project Charter",
            "## Obiettivi del progetto",
            "Obiettivi principali del progetto.",
            "{{text:obiettivi_progetto}}",
          ].join("\n"),
          model: "minimal-ollama-charter-test",
          latencyMs: 2,
        };
      }
    }
    process.env.AI_PROVIDER = "ollama";
    const placeholderService = new TemplatePlaceholderService();
    const auditService = new TemplateAuditService(placeholderService, {
      auditTemplate: jest.fn().mockResolvedValue({
        warnings: [],
        provider: "mock",
        model: "mock-semantic-rules-v1",
        latencyMs: 1,
      }),
    } as never);
    const service = new TemplateDraftGenerationService(
      placeholderService,
      auditService,
      new MockAiProvider(),
      new MinimalOllamaProvider(),
    );
    const result = await service.generateDraft({
      description:
        "Genera un project charter completo per un nuovo programma digitale.",
      language: "it",
      runSemanticAudit: false,
    });

    expect(result.content).toContain("## Benefici attesi");
    expect(result.content).toContain("## Ambito preliminare del progetto");
    expect(result.content).toContain("## Deliverable principali");
    expect(result.content).toContain("## Milestone principali");
    expect(result.content).toContain("## Stakeholder principali");
    expect(result.content).toMatch(/## Ruoli e responsabilit[àa] iniziali/);
    expect(result.content).toContain("## Requisiti di alto livello");
    expect(result.content).toContain("## Assunzioni");
    expect(result.content).toContain("## Vincoli");
    expect(result.content).toContain("## Rischi iniziali");
    expect(result.content).toContain("## Budget preliminare");
    expect(result.content).toContain("## Criteri di successo");
    expect(result.content).toContain("## Autorita del Project Manager");
    expect(result.content).toContain("## Approvazioni finali");
    expect(result.content).not.toContain("{{list:");
    expect(result.deterministic.warnings).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "MISSING_REQUIRED_SECTION" }),
      ]),
    );
  });

  it("post-processes Project Charter to remove generic headings, conflicting types and fragile table text fields", async () => {
    class NoisyCharterProvider extends OllamaAiProvider {
      override async generateTemplateDraft() {
        return {
          markdown: [
            "# Project Charter",
            "## Descrizione del progetto",
            "Breve testo introduttivo.",
            "{{string:descrizione_progetto}}",
            "## Campi compilabili",
            "- {{text:descrizione_progetto}}",
            "## Business case o motivazione del progetto",
            "Motivazione economica.",
            "Budget preliminare: {{integer:budget_preliminare_euro}}",
            "Fonti finanziarie: {{text:fonti_finanziarie}}",
            "## Stakeholder principali",
            "| Nome | Responsabilita |",
            "| --- | --- |",
            "| {{string:nome_stakeholder_1}} | {{text:responsabilita_stakeholder_1}} |",
          ].join("\n"),
          model: "noisy-charter-test",
          latencyMs: 2,
        };
      }
    }
    process.env.AI_PROVIDER = "ollama";
    const placeholderService = new TemplatePlaceholderService();
    const auditService = new TemplateAuditService(placeholderService, {
      auditTemplate: jest.fn().mockResolvedValue({
        warnings: [],
        provider: "mock",
        model: "mock-semantic-rules-v1",
        latencyMs: 1,
      }),
    } as never);
    const service = new TemplateDraftGenerationService(
      placeholderService,
      auditService,
      new MockAiProvider(),
      new NoisyCharterProvider(),
    );

    const result = await service.generateDraft({
      description: "Genera un project charter completo.",
      language: "it",
      runSemanticAudit: false,
    });

    expect(result.content).not.toContain("## Campi compilabili");
    expect(result.content).not.toContain("{{string:descrizione_progetto}}");
    expect(result.content).toContain("{{text:descrizione_progetto:400:true}}");
    expect(result.content).toContain("{{string:stakeholder_1:120:true}}");
    expect(result.content).toContain("{{string:ruolo_1:120:true}}");
    expect(result.content).toContain("{{string:interesse_1:120:true}}");
    expect(result.content).not.toContain(
      "{{text:responsabilita_stakeholder_1}}",
    );
    expect(result.content).toContain("## Rischi iniziali");
    expect(result.content).toContain("## Budget preliminare");
    expect(result.content).toContain("## Criteri di successo");
    expect(result.content).toContain("## Autorita del Project Manager");
    expect(result.content).toContain("## Approvazioni finali");
  });

  it("does not force Project Charter scaffold for non-charter natural requests", async () => {
    class MinimalOllamaProvider extends OllamaAiProvider {
      override async generateTemplateDraft() {
        return {
          markdown: [
            "# Documento operativo",
            "## Ruoli e responsabilita",
            "Definire responsabilita operative.",
            "{{text:ruoli_responsabilita}}",
          ].join("\n"),
          model: "minimal-ollama-generic-test",
          latencyMs: 2,
        };
      }
    }
    process.env.AI_PROVIDER = "ollama";
    const placeholderService = new TemplatePlaceholderService();
    const auditService = new TemplateAuditService(placeholderService, {
      auditTemplate: jest.fn().mockResolvedValue({
        warnings: [],
        provider: "mock",
        model: "mock-semantic-rules-v1",
        latencyMs: 1,
      }),
    } as never);
    const service = new TemplateDraftGenerationService(
      placeholderService,
      auditService,
      new MockAiProvider(),
      new MinimalOllamaProvider(),
    );
    const result = await service.generateDraft({
      description:
        "Genera un documento sanitario su responsabilita, doveri e regole operative.",
      language: "it",
      runSemanticAudit: false,
    });

    expect(result.content).toContain("# Documento operativo");
    expect(result.content).not.toContain("## Approvazioni finali");
    expect(result.content).not.toContain("## Autorita del Project Manager");
    expect(result.content).not.toContain(
      "## Business case o motivazione del progetto",
    );
  });

  it("builds modular prompt blocks and keeps profile-specific rules out of generic requests", async () => {
    class CapturingProvider extends MockAiProvider {
      public lastDescription = "";
      override async generateTemplateDraft(
        input: Parameters<MockAiProvider["generateTemplateDraft"]>[0],
      ) {
        this.lastDescription = input.description;
        return {
          markdown:
            "# Documento\n\n## Contesto\nDescrizione.\n{{string:titolo_documento}}",
          model: "capturing-provider",
          latencyMs: 1,
        };
      }
    }

    process.env.AI_PROVIDER = "mock";
    const placeholderService = new TemplatePlaceholderService();
    const auditService = new TemplateAuditService(placeholderService, {
      auditTemplate: jest.fn().mockResolvedValue({
        warnings: [],
        provider: "mock",
        model: "mock-semantic-rules-v1",
        latencyMs: 1,
      }),
    } as never);
    const capturingProvider = new CapturingProvider();
    const service = new TemplateDraftGenerationService(
      placeholderService,
      auditService,
      capturingProvider,
      new OllamaAiProvider(),
    );

    await service.generateDraft({
      description:
        "Genera una scheda assicurativa sintetica per nuova polizza.",
      language: "it",
      runSemanticAudit: false,
    });

    expect(capturingProvider.lastDescription).toContain(
      "[COMMON_PROMPT_RULES]",
    );
    expect(capturingProvider.lastDescription).toContain(
      "[DOCUMENT_TYPE_PROFILE]",
    );
    expect(capturingProvider.lastDescription).toContain("[DOMAIN_PROFILE]");
    expect(capturingProvider.lastDescription).toContain("document_type=scheda");
    expect(capturingProvider.lastDescription).not.toContain(
      "reference_standard=PMBOK_PMI",
    );
  });

  it("injects PMBOK reference only for project_charter profile", async () => {
    class CapturingProvider extends MockAiProvider {
      public lastDescription = "";
      override async generateTemplateDraft(
        input: Parameters<MockAiProvider["generateTemplateDraft"]>[0],
      ) {
        this.lastDescription = input.description;
        return {
          markdown:
            "# Project Charter\n\n## Titolo e informazioni generali del progetto\nTesto.\n{{string:nome_progetto}}",
          model: "capturing-provider-charter",
          latencyMs: 1,
        };
      }
    }

    process.env.AI_PROVIDER = "mock";
    const placeholderService = new TemplatePlaceholderService();
    const auditService = new TemplateAuditService(placeholderService, {
      auditTemplate: jest.fn().mockResolvedValue({
        warnings: [],
        provider: "mock",
        model: "mock-semantic-rules-v1",
        latencyMs: 1,
      }),
    } as never);
    const capturingProvider = new CapturingProvider();
    const service = new TemplateDraftGenerationService(
      placeholderService,
      auditService,
      capturingProvider,
      new OllamaAiProvider(),
    );

    await service.generateDraft({
      description:
        "Genera un Project Charter completo per iniziativa digitale.",
      language: "it",
      runSemanticAudit: false,
    });

    expect(capturingProvider.lastDescription).toContain(
      "document_type=project_charter",
    );
    expect(capturingProvider.lastDescription).toContain(
      "reference_standard=PMBOK_PMI",
    );
  });

  it("flags generic section title as didactic issue when description is placeholder-only", async () => {
    class GenericTitleProvider extends MockAiProvider {
      override async generateTemplateDraft() {
        return {
          markdown: [
            "# Project Charter",
            "### Breve descrizione del contesto e dell'obiettivo della sezione",
            "In questa sezione indicare le informazioni richieste.",
            "{{text:descrizione_progetto}}",
          ].join("\n"),
          model: "generic-title-test",
          latencyMs: 2,
        };
      }
    }
    process.env.AI_PROVIDER = "mock";
    const placeholderService = new TemplatePlaceholderService();
    const auditService = new TemplateAuditService(placeholderService, {
      auditTemplate: jest.fn().mockResolvedValue({
        warnings: [],
        provider: "mock",
        model: "mock-semantic-rules-v1",
        latencyMs: 1,
      }),
    } as never);
    const service = new TemplateDraftGenerationService(
      placeholderService,
      auditService,
      new GenericTitleProvider(),
      new OllamaAiProvider(),
    );
    const result = await service.generateDraft({
      description: "Template charter",
      language: "it",
      runSemanticAudit: false,
    });
    expect(
      result.evaluation.didacticQuality.issues.some((issue) =>
        issue.startsWith("SECTION_DESCRIPTION_TOO_GENERIC:"),
      ),
    ).toBe(true);
  });

  it("marks truncated output as not savable when markdown is split/truncated", async () => {
    class TruncatedProvider extends MockAiProvider {
      override async generateTemplateDraft() {
        return {
          markdown: [
            "# Project Charter",
            "| A | B | C |",
            "| --- | --- | --- |",
            "| x | y |",
            "| {{boolean:flag}} |",
          ].join("\n"),
          model: "truncated-output-test",
          latencyMs: 2,
        };
      }
    }
    process.env.AI_PROVIDER = "mock";
    const placeholderService = new TemplatePlaceholderService();
    const auditService = new TemplateAuditService(placeholderService, {
      auditTemplate: jest.fn().mockResolvedValue({
        warnings: [],
        provider: "mock",
        model: "mock-semantic-rules-v1",
        latencyMs: 1,
      }),
    } as never);
    const service = new TemplateDraftGenerationService(
      placeholderService,
      auditService,
      new TruncatedProvider(),
      new OllamaAiProvider(),
    );
    const result = await service.generateDraft({
      description: "Template charter",
      language: "it",
      runSemanticAudit: false,
    });
    expect(result.deterministic.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "OUTPUT_TRUNCATED" }),
      ]),
    );
    expect(result.savable).toBe(false);
  });

  it("generates Project Charter with complete risks table columns", async () => {
    process.env.AI_PROVIDER = "mock";
    const placeholderService = new TemplatePlaceholderService();
    const auditService = new TemplateAuditService(placeholderService, {
      auditTemplate: jest.fn().mockResolvedValue({
        warnings: [],
        provider: "mock",
        model: "mock-semantic-rules-v1",
        latencyMs: 1,
      }),
    } as never);
    const service = new TemplateDraftGenerationService(
      placeholderService,
      auditService,
      new MockAiProvider(),
      new OllamaAiProvider(),
    );
    const result = await service.generateDraft({
      description: "Genera un Project Charter completo",
      language: "it",
      runSemanticAudit: false,
    });
    const risksSection = extractSection(result.content, "Rischi iniziali");
    expect(risksSection).toContain(
      "| Rischio | Descrizione | Probabilità | Impatto | Mitigazione |",
    );
  });

  it("does not generate list placeholders with non numeric maxLength in Project Charter", async () => {
    process.env.AI_PROVIDER = "mock";
    const placeholderService = new TemplatePlaceholderService();
    const auditService = new TemplateAuditService(placeholderService, {
      auditTemplate: jest.fn().mockResolvedValue({
        warnings: [],
        provider: "mock",
        model: "mock-semantic-rules-v1",
        latencyMs: 1,
      }),
    } as never);
    const service = new TemplateDraftGenerationService(
      placeholderService,
      auditService,
      new MockAiProvider(),
      new OllamaAiProvider(),
    );
    const result = await service.generateDraft({
      description: "Project Charter con rischi e budget",
      language: "it",
      runSemanticAudit: false,
    });
    expect(result.content).not.toMatch(/\{\{list:[^:}]+:length:/i);
  });

  it("does not generate list placeholders with space-containing options in Project Charter", async () => {
    process.env.AI_PROVIDER = "mock";
    const placeholderService = new TemplatePlaceholderService();
    const auditService = new TemplateAuditService(placeholderService, {
      auditTemplate: jest.fn().mockResolvedValue({
        warnings: [],
        provider: "mock",
        model: "mock-semantic-rules-v1",
        latencyMs: 1,
      }),
    } as never);
    const service = new TemplateDraftGenerationService(
      placeholderService,
      auditService,
      new MockAiProvider(),
      new OllamaAiProvider(),
    );
    const result = await service.generateDraft({
      description: "Project Charter con rischi iniziali",
      language: "it",
      runSemanticAudit: false,
    });
    expect(result.content).not.toMatch(/\{\{list:[^}]*:[^,}]*\s+[^,}]*,/i);
    expect(result.content.toLowerCase()).not.toContain("{{list:rischi");
    expect(result.content.toLowerCase()).not.toContain("rischi_aggiuntivi");
  });

  it("injects only active profile anti-patterns into the draft prompt", async () => {
    class CapturingProvider extends MockAiProvider {
      public lastDescription = "";
      override async generateTemplateDraft(
        input: Parameters<MockAiProvider["generateTemplateDraft"]>[0],
      ) {
        this.lastDescription = input.description;
        return {
          markdown:
            "# Project Charter\n\n## Titolo e informazioni generali del progetto\n{{string:nome_progetto}}",
          model: "capturing-project-charter-risk-rule",
          latencyMs: 1,
        };
      }
    }

    process.env.AI_PROVIDER = "mock";
    const placeholderService = new TemplatePlaceholderService();
    const auditService = new TemplateAuditService(placeholderService, {
      auditTemplate: jest.fn().mockResolvedValue({
        warnings: [],
        provider: "mock",
        model: "mock-semantic-rules-v1",
        latencyMs: 1,
      }),
    } as never);
    const capturingProvider = new CapturingProvider();
    const service = new TemplateDraftGenerationService(
      placeholderService,
      auditService,
      capturingProvider,
      new OllamaAiProvider(),
    );
    await service.generateDraft({
      description: "Project Charter completo",
      language: "it",
      runSemanticAudit: false,
    });
    expect(capturingProvider.lastDescription).toContain(
      "Non trasformare il charter in piano operativo di dettaglio.",
    );
    expect(capturingProvider.lastDescription).not.toContain(
      "rischi_aggiuntivi",
    );
  });

  it("uses string placeholders in Project Charter table cells for known structured fields", async () => {
    process.env.AI_PROVIDER = "mock";
    const placeholderService = new TemplatePlaceholderService();
    const auditService = new TemplateAuditService(placeholderService, {
      auditTemplate: jest.fn().mockResolvedValue({
        warnings: [],
        provider: "mock",
        model: "mock-semantic-rules-v1",
        latencyMs: 1,
      }),
    } as never);
    const service = new TemplateDraftGenerationService(
      placeholderService,
      auditService,
      new MockAiProvider(),
      new OllamaAiProvider(),
    );
    const result = await service.generateDraft({
      description: "Project Charter professionale",
      language: "it",
      runSemanticAudit: false,
    });
    expect(result.content).not.toContain("{{text:descrizione_1}}");
    expect(result.content).not.toContain("{{text:incluso_1}}");
    expect(result.content).not.toContain("{{text:escluso_1}}");
    expect(result.content).not.toContain("{{text:note_1}}");
    expect(result.content).toContain("{{string:descrizione_1:120:true}}");
    expect(result.content).toContain("{{string:incluso_1:120:true}}");
    expect(result.content).toContain("{{string:escluso_1:120:true}}");
    expect(result.content).toContain("{{string:note_1:120:true}}");
  });

  it.each([
    ["Fammi un Project Charter", "project_charter", "project_management"],
    ["Genera un verbale tecnico", "verbale", "tecnico"],
    ["Mi serve un report economico", "report", "economico"],
    ["Crea una scheda assicurativa", "scheda", "assicurativo"],
    ["Fammi una checklist operativa", "checklist", "generico"],
    ["Genera un piano di progetto", "project_plan", "project_management"],
    ["Crea un capitolato tecnico", "capitolato", "tecnico"],
    [
      "Fammi un template per la gestione di una pratica amministrativa",
      "procedure",
      "amministrativo",
    ],
  ])("builds prompt blocks for short natural prompt: %s", async (prompt, expectedType, expectedDomain) => {
    class CapturingProvider extends MockAiProvider {
      public lastDescription = "";
      override async generateTemplateDraft(
        input: Parameters<MockAiProvider["generateTemplateDraft"]>[0],
      ) {
        this.lastDescription = input.description;
        return {
          markdown: "# Documento\n\n## Contesto\n{{string:contesto_documento}}",
          model: "capturing-short-prompt",
          latencyMs: 1,
        };
      }
    }
    process.env.AI_PROVIDER = "mock";
    const placeholderService = new TemplatePlaceholderService();
    const auditService = new TemplateAuditService(placeholderService, {
      auditTemplate: jest.fn().mockResolvedValue({
        warnings: [],
        provider: "mock",
        model: "mock-semantic-rules-v1",
        latencyMs: 1,
      }),
    } as never);
    const capturingProvider = new CapturingProvider();
    const service = new TemplateDraftGenerationService(
      placeholderService,
      auditService,
      capturingProvider,
      new OllamaAiProvider(),
    );

    await service.generateDraft({
      description: prompt,
      language: "it",
      runSemanticAudit: false,
    });

    expect(capturingProvider.lastDescription).toContain(
      `document_type=${expectedType}`,
    );
    expect(capturingProvider.lastDescription).toContain(
      `domain=${expectedDomain}`,
    );
    expect(capturingProvider.lastDescription).toContain(
      "[COMMON_PROMPT_RULES]",
    );
    expect(capturingProvider.lastDescription).toContain(
      "[DOCUMENT_TYPE_PROFILE]",
    );
    expect(capturingProvider.lastDescription).toContain("[DOMAIN_PROFILE]");
  });
});
