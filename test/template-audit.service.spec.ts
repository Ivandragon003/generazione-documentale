import { MockAiProvider } from "../src/service/ai/mock-ai.provider";
import { OllamaAiProvider } from "../src/service/ai/ollama-ai.provider";
import { AiTemplateAuditorService } from "../src/service/ai-template-auditor.service";
import { TemplateAuditService } from "../src/service/template-audit.service";
import { TemplatePlaceholderService } from "../src/service/template-placeholder.service";

describe("TemplateAuditService", () => {
  let service: TemplateAuditService;
  const completeProjectCharterMarkdown = [
    "# Project Charter",
    "## Titolo e informazioni generali del progetto",
    "La sezione identifica il progetto e i riferimenti iniziali necessari per l'approvazione formale.",
    "Nome progetto: {{string:nome_progetto}}",
    "## Descrizione del progetto",
    "La sezione descrive il contesto, l'opportunita e il risultato atteso in modo utile per sponsor e stakeholder.",
    "{{text:descrizione_progetto}}",
    "## Business case o motivazione del progetto",
    "La sezione chiarisce la creazione di valore e la motivazione organizzativa alla base dell'investimento.",
    "{{text:business_case}}",
    "## Obiettivi del progetto",
    "La sezione definisce obiettivi misurabili e criteri di avanzamento progetto.",
    "| Obiettivo | Descrizione | Metrica | Target |",
    "|---|---|---|---|",
    "| {{string:obiettivo_1}} | {{string:descrizione_obiettivo_1}} | {{string:metrica_obiettivo_1}} | {{string:target_obiettivo_1}} |",
    "## Benefici attesi",
    "La sezione descrive i benefici attesi e il valore prodotto per l'organizzazione.",
    "| Beneficio | Indicatore | Valore atteso |",
    "|---|---|---|",
    "| {{string:beneficio_1}} | {{string:indicatore_beneficio_1}} | {{string:valore_atteso_beneficio_1}} |",
    "## Ambito preliminare del progetto",
    "La sezione delimita confini, inclusioni ed esclusioni iniziali del lavoro.",
    "| Incluso | Escluso | Note |",
    "|---|---|---|",
    "| {{string:ambito_incluso_1}} | {{string:ambito_escluso_1}} | {{string:note_ambito_1}} |",
    "## Deliverable principali",
    "La tabella sintetizza i risultati principali attesi e il criterio con cui saranno accettati.",
    "| Deliverable | Descrizione | Criterio di accettazione |",
    "|---|---|---|",
    "| {{string:deliverable_1}} | {{string:descrizione_deliverable_1}} | {{string:criterio_accettazione_deliverable_1}} |",
    "## Milestone principali",
    "La tabella indica le tappe principali usate per monitorare l'avanzamento progetto.",
    "| Milestone | Data prevista | Risultato atteso |",
    "|---|---|---|",
    "| {{string:milestone_1}} | {{date:data_milestone_1}} | {{string:risultato_milestone_1}} |",
    "## Stakeholder principali",
    "La tabella identifica gli stakeholder chiave e il loro interesse nel progetto.",
    "| Stakeholder | Ruolo | Interesse |",
    "|---|---|---|",
    "| {{string:stakeholder_1}} | {{string:ruolo_stakeholder_1}} | {{string:interesse_stakeholder_1}} |",
    "## Ruoli e responsabilita iniziali",
    "La tabella assegna responsabilita iniziali per rendere chiaro il modello operativo.",
    "| Ruolo | Responsabilita | Referente |",
    "|---|---|---|",
    "| {{string:ruolo_1}} | {{string:responsabilita_ruolo_1}} | {{string:referente_ruolo_1}} |",
    "## Requisiti di alto livello",
    "La tabella raccoglie requisiti di alto livello da dettagliare nelle fasi successive.",
    "| Requisito | Descrizione | Priorita |",
    "|---|---|---|",
    "| {{string:requisito_1}} | {{string:descrizione_requisito_1}} | {{string:priorita_requisito_1}} |",
    "## Assunzioni",
    "La sezione registra le ipotesi considerate vere all'avvio e da verificare durante il progetto.",
    "{{text:assunzioni_principali}}",
    "## Vincoli",
    "La sezione documenta limiti temporali, economici, tecnici o organizzativi che condizionano il piano.",
    "{{text:vincoli_principali}}",
    "## Rischi iniziali",
    "La tabella evidenzia i rischi iniziali e le prime azioni di mitigazione.",
    "| Rischio | Descrizione | Probabilità | Impatto | Mitigazione |",
    "|---|---|---|---|---|",
    "| {{string:rischio_1}} | {{string:descrizione_rischio_1}} | {{percentage:probabilita_rischio_1}} | {{string:impatto_rischio_1}} | {{string:mitigazione_rischio_1}} |",
    "## Budget preliminare",
    "La sezione indica la stima economica iniziale e le fonti di finanziamento note.",
    "| Voce di costo | Importo stimato | Note |",
    "|---|---|---|",
    "| {{string:voce_costo_1}} | {{currency:importo_stimato_1}} | {{string:note_budget_1}} |",
    "## Criteri di successo",
    "La sezione definisce condizioni misurabili per valutare il successo del progetto.",
    "{{text:criteri_successo}}",
    "## Autorita del Project Manager",
    "La sezione chiarisce poteri decisionali, limiti e autonomia concessa al project manager.",
    "| Ambito decisionale | Limite/autonomia | Note |",
    "|---|---|---|",
    "| {{string:ambito_decisionale_pm_1}} | {{string:limite_autonomia_pm_1}} | {{string:note_autorita_pm_1}} |",
    "## Approvazioni finali",
    "La tabella raccoglie le approvazioni formali necessarie per autorizzare il Project Charter.",
    "| Nome | Ruolo | Data approvazione | Firma/Conferma |",
    "|---|---|---|---|",
    "| {{string:nome_approvatore_1}} | {{string:ruolo_approvatore_1}} | {{date:data_approvazione_1}} | {{string:firma_conferma_1}} |",
  ].join("\n");

  beforeEach(() => {
    process.env.AI_PROVIDER = "mock";
    service = new TemplateAuditService(
      new TemplatePlaceholderService(),
      new AiTemplateAuditorService(
        new MockAiProvider(),
        new OllamaAiProvider(),
      ),
    );
  });

  it("parses valid placeholders", async () => {
    const report = await service.audit({
      content: "Cliente: {{string:nome_cliente}}",
      runAi: false,
    });
    expect(report.deterministic.errors).toEqual([]);
    expect(report.deterministic.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "nome_cliente", type: "string" }),
      ]),
    );
  });

  it("accepts markdown tables with valid placeholders inside cells", async () => {
    const report = await service.audit({
      content: [
        "| Nome | Ruolo | Responsabilita |",
        "|------|-------|----------------|",
        "| {{string:nome_stakeholder_1}} | {{string:ruolo_stakeholder_1}} | {{text:responsabilita_stakeholder_1}} |",
        "| {{string:nome_stakeholder_2}} | {{string:ruolo_stakeholder_2}} | {{text:responsabilita_stakeholder_2}} |",
      ].join("\n"),
      runAi: false,
    });
    expect(report.deterministic.errors).toEqual([]);
  });

  it("detects malformed placeholder", async () => {
    const report = await service.audit({
      content: "Cliente: {{string:nome_cliente",
      runAi: false,
    });
    expect(report.deterministic.errors).toContainEqual(
      expect.objectContaining({ code: "UNCLOSED_PLACEHOLDER" }),
    );
  });

  it("marks accented field_name as auto-fixable with normalized suggestion", async () => {
    const report = await service.audit({
      content: "Unita: {{string:unità_responsabile}}",
      runAi: false,
    });
    expect(report.deterministic.errors).toContainEqual(
      expect.objectContaining({
        code: "INVALID_FORMAT",
        autoFixable: true,
        suggestion: "{{string:unita_responsabile}}",
      }),
    );
  });

  it("marks table row split as blocking truncated-output error", async () => {
    const report = await service.audit({
      content: [
        "| A | B | C |",
        "| --- | --- | --- |",
        "| x | y |",
        "| {{boolean:flag}} |",
      ].join("\n"),
      runAi: false,
    });
    expect(report.deterministic.errors).toContainEqual(
      expect.objectContaining({
        code: "TABLE_ROW_SPLIT",
        blocking: true,
      }),
    );
    expect(report.deterministic.errors).toContainEqual(
      expect.objectContaining({
        code: "OUTPUT_TRUNCATED",
        blocking: true,
      }),
    );
  });

  it("detects invalid type with deterministic suggestion", async () => {
    const report = await service.audit({
      content: "Cliente: {{strnig:nome_cliente}}",
      runAi: false,
    });
    expect(report.deterministic.errors).toContainEqual(
      expect.objectContaining({
        code: "UNSUPPORTED_TYPE",
        suggestion: "{{string:nome_cliente}}",
        autoFixable: true,
      }),
    );
  });

  it("detects duplicated field usage", async () => {
    const report = await service.audit({
      content: "{{string:nome_cliente}}\n{{string:nome_cliente}}",
      runAi: false,
    });
    expect(report.deterministic.warnings).toContainEqual(
      expect.objectContaining({
        code: "DUPLICATED_FIELD",
        fieldName: "nome_cliente",
      }),
    );
    expect(report.deterministic.errors).toContainEqual(
      expect.objectContaining({
        code: "DUPLICATED_FIELD",
        fieldName: "nome_cliente",
        blocking: true,
      }),
    );
  });

  it("detects redundant field declaration in Campi section", async () => {
    const report = await service.audit({
      content: [
        "## Ambito preliminare",
        "Testo di supporto.",
        "{{text:ambito_preliminare}}",
        "## Campi compilabili",
        "- {{text:ambito_preliminare}}",
      ].join("\n"),
      runAi: false,
    });
    expect(report.deterministic.warnings).toContainEqual(
      expect.objectContaining({
        code: "REDUNDANT_FIELD_DECLARATION",
        fieldName: "ambito_preliminare",
      }),
    );
  });

  it("warns when placeholder is not in canonical extended form", async () => {
    const report = await service.audit({
      content: "Nome progetto: {{string:nome_progetto}}",
      runAi: false,
    });
    expect(report.deterministic.warnings).toContainEqual(
      expect.objectContaining({
        code: "NON_CANONICAL_PLACEHOLDER_FORM",
        placeholder: "{{string:nome_progetto}}",
      }),
    );
  });

  it("detects missing required Project Charter sections", async () => {
    const report = await service.audit({
      content: [
        "# Project Charter",
        "## Obiettivi del progetto",
        "Testo utile.",
        "{{text:obiettivi_progetto}}",
      ].join("\n"),
      runAi: false,
    });
    expect(report.deterministic.warnings).toContainEqual(
      expect.objectContaining({
        code: "MISSING_REQUIRED_SECTION",
      }),
    );
    expect(report.deterministic.warnings).toContainEqual(
      expect.objectContaining({
        code: "MISSING_REQUIRED_SECTION",
        message: expect.stringContaining("Benefici attesi"),
      }),
    );
    expect(report.deterministic.errors).toContainEqual(
      expect.objectContaining({
        code: "MISSING_REQUIRED_SECTION",
        blocking: true,
      }),
    );
  });

  it("does not enforce Project Charter required sections for non-charter document types", async () => {
    const report = await service.audit({
      content: [
        "# Verbale di riunione",
        "## Informazioni riunione",
        "Contesto e obiettivo della riunione.",
        "{{date:data_riunione}}",
      ].join("\n"),
      runAi: false,
      expectedDocumentType: "verbale",
    });

    expect(report.deterministic.errors).toContainEqual(
      expect.objectContaining({
        code: "MISSING_REQUIRED_SECTION",
        message: expect.stringContaining("Decisioni"),
      }),
    );
  });

  it("fails audit when report misses economic required sections", async () => {
    const report = await service.audit({
      content: [
        "# Report economico trimestrale",
        "## Periodo di riferimento",
        "{{string:periodo_riferimento}}",
        "## KPI principali",
        "| KPI | Valore |",
        "|---|---|",
        "| {{string:kpi_1}} | {{currency:valore_kpi_1}} |",
      ].join("\n"),
      runAi: false,
      expectedDocumentType: "report",
    });

    expect(report.deterministic.errors).toContainEqual(
      expect.objectContaining({
        code: "MISSING_REQUIRED_SECTION",
        message: expect.stringContaining("Ricavi"),
      }),
    );
  });

  it("fails audit for profile contamination when report includes Project Charter sections", async () => {
    const report = await service.audit({
      content: [
        "# Report economico",
        "## Periodo di riferimento",
        "{{string:periodo_riferimento}}",
        "## KPI principali",
        "| KPI | Valore |",
        "|---|---|",
        "| {{string:kpi_1}} | {{currency:valore_kpi_1}} |",
        "## Business case o motivazione del progetto",
        "{{text:business_case}}",
      ].join("\n"),
      runAi: false,
      expectedDocumentType: "report",
    });

    expect(report.deterministic.errors).toContainEqual(
      expect.objectContaining({
        code: "PROFILE_CONTAMINATION",
        blocking: true,
      }),
    );
  });

  it("fails audit for profile contamination when scheda assicurativa includes verbale sections", async () => {
    const report = await service.audit({
      content: [
        "# Scheda assicurativa",
        "## Dati polizza",
        "{{string:numero_polizza}}",
        "## Contraente",
        "{{string:nome_contraente}}",
        "## Ordine del giorno",
        "{{text:punti_odg}}",
      ].join("\n"),
      runAi: false,
      expectedDocumentType: "scheda",
    });

    expect(report.deterministic.errors).toContainEqual(
      expect.objectContaining({
        code: "PROFILE_CONTAMINATION",
        blocking: true,
      }),
    );
  });

  it("fails audit when assicurativa scheda misses mandatory sections", async () => {
    const report = await service.audit({
      content: [
        "# Scheda assicurativa",
        "## Dati polizza",
        "{{string:numero_polizza}}",
        "## Contraente",
        "{{string:nome_contraente}}",
      ].join("\n"),
      runAi: false,
      expectedDocumentType: "scheda",
    });

    expect(report.deterministic.errors).toContainEqual(
      expect.objectContaining({
        code: "MISSING_REQUIRED_SECTION",
        message: expect.stringContaining("Coperture"),
      }),
    );
  });

  it("flags duplicated sections without document-type-specific severity", async () => {
    const report = await service.audit({
      content: [
        completeProjectCharterMarkdown,
        "## Requisiti di alto livello",
        "Duplicazione non ammessa nel Project Charter.",
        "{{string:requisito_extra}}",
      ].join("\n"),
      runAi: false,
    });

    expect(report.deterministic.warnings).toContainEqual(
      expect.objectContaining({
        code: "DUPLICATED_SECTION",
        blocking: false,
      }),
    );
  });

  it("fails audit for table and subtable placeholder types", async () => {
    const report = await service.audit({
      content: [
        "# Project Charter",
        "## Obiettivi del progetto",
        "{{table:obiettivi:120:true}}",
        "## Rischi iniziali",
        "{{subtable:rischi:120:true}}",
      ].join("\n"),
      runAi: false,
      expectedDocumentType: "project_charter",
    });

    expect(report.deterministic.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "UNSUPPORTED_TYPE",
          invalidType: "table",
          blocking: true,
        }),
        expect.objectContaining({
          code: "UNSUPPORTED_TYPE",
          invalidType: "subtable",
          blocking: true,
        }),
      ]),
    );
  });

  it("fails audit when a required Project Charter table section has no table", async () => {
    const report = await service.audit({
      content: completeProjectCharterMarkdown
        .replace(
          "| Deliverable | Descrizione | Criterio di accettazione |\n",
          "",
        )
        .replace("|---|---|---|\n", "")
        .replace(
          "| {{string:deliverable_1}} | {{string:descrizione_deliverable_1}} | {{string:criterio_accettazione_deliverable_1}} |\n",
          "",
        ),
      runAi: false,
    });

    expect(report.deterministic.errors).toContainEqual(
      expect.objectContaining({
        code: "MISSING_REQUIRED_TABLE",
        message: expect.stringContaining("Deliverable principali"),
        blocking: true,
      }),
    );
  });

  it("fails audit when Project Charter risks table misses impatto column", async () => {
    const report = await service.audit({
      content: completeProjectCharterMarkdown
        .replace(
          "| Rischio | Descrizione | Probabilità | Impatto | Mitigazione |",
          "| Rischio | Descrizione | Probabilità | Mitigazione |",
        )
        .replace("|---|---|---|---|---|", "|---|---|---|---|"),
      runAi: false,
    });

    expect(report.deterministic.errors).toContainEqual(
      expect.objectContaining({
        code: "MISSING_TABLE_COLUMNS",
        message: expect.stringContaining("Rischi iniziali"),
      }),
    );
  });

  it("deduplicates equivalent MISSING_TABLE_COLUMNS issues for the same section", async () => {
    const duplicated = [
      "# Project Charter",
      "## Rischi iniziali",
      "| Rischio | Descrizione | Mitigazione |",
      "|---|---|---|",
      "| {{string:rischio_1}} | {{string:descrizione_rischio_1}} | {{string:mitigazione_rischio_1}} |",
      "## Rischi iniziali",
      "| Rischio | Descrizione | Mitigazione |",
      "|---|---|---|",
      "| {{string:rischio_2}} | {{string:descrizione_rischio_2}} | {{string:mitigazione_rischio_2}} |",
    ].join("\n");

    const report = await service.audit({ content: duplicated, runAi: false });
    const missingColumns = report.deterministic.errors.filter(
      (issue) =>
        issue.code === "MISSING_TABLE_COLUMNS" &&
        issue.message.includes("Rischi iniziali"),
    );
    expect(missingColumns).toHaveLength(1);
  });

  it("fails audit when Project Charter approvals table misses firma/conferma column", async () => {
    const report = await service.audit({
      content: completeProjectCharterMarkdown
        .replace(
          "| Nome | Ruolo | Data approvazione | Firma/Conferma |",
          "| Nome | Ruolo | Data approvazione |",
        )
        .replace(
          "| {{string:nome_approvatore_1}} | {{string:ruolo_approvatore_1}} | {{date:data_approvazione_1}} | {{string:firma_conferma_1}} |",
          "| {{string:nome_approvatore_1}} | {{string:ruolo_approvatore_1}} | {{date:data_approvazione_1}} |",
        ),
      runAi: false,
    });

    expect(report.deterministic.errors).toContainEqual(
      expect.objectContaining({
        code: "MISSING_TABLE_COLUMNS",
        message: expect.stringContaining("Approvazioni finali"),
      }),
    );
  });

  it("detects consecutive duplicated titles as blocking issue", async () => {
    const report = await service.audit({
      content: [
        "# Report",
        "## KPI principali",
        "Testo descrittivo.",
        "## KPI principali",
        "Altra descrizione.",
      ].join("\n"),
      runAi: false,
    });

    expect(report.deterministic.errors).toContainEqual(
      expect.objectContaining({
        code: "DUPLICATED_CONSECUTIVE_TITLE",
        blocking: true,
      }),
    );
  });

  it("detects placeholders used in markdown titles", async () => {
    const report = await service.audit({
      content:
        "### {{text:descrizione_progetto}}\n{{text:descrizione_progetto}}",
      runAi: false,
    });
    expect(report.deterministic.warnings).toContainEqual(
      expect.objectContaining({
        code: "PLACEHOLDER_IN_TITLE",
        placeholder: "{{text:descrizione_progetto}}",
      }),
    );
    expect(report.deterministic.warnings).toContainEqual(
      expect.objectContaining({
        code: "DUPLICATED_FIELD",
        fieldName: "descrizione_progetto",
      }),
    );
  });

  it("marks PLACEHOLDER_IN_TITLE as auto-fixable when heading contains only one placeholder", async () => {
    const report = await service.audit({
      content: "### {{text:descrizione_progetto}}\nContenuto",
      runAi: false,
    });
    expect(report.deterministic.warnings).toContainEqual(
      expect.objectContaining({
        code: "PLACEHOLDER_IN_TITLE",
        autoFixable: true,
      }),
    );
  });

  it("keeps PLACEHOLDER_IN_TITLE non auto-fixable when heading is ambiguous", async () => {
    const report = await service.audit({
      content: "### Progetto {{text:descrizione_progetto}}",
      runAi: false,
    });
    expect(report.deterministic.warnings).toContainEqual(
      expect.objectContaining({
        code: "PLACEHOLDER_IN_TITLE",
        autoFixable: false,
      }),
    );
  });

  it("detects conflicting field types", async () => {
    const report = await service.audit({
      content: "{{string:nome_cliente}}\n{{date:nome_cliente}}",
      runAi: false,
    });
    expect(report.deterministic.errors).toContainEqual(
      expect.objectContaining({ code: "CONFLICTING_FIELD_TYPE" }),
    );
  });

  it("emits MISSING_TYPE warning for legacy untyped placeholders", async () => {
    const report = await service.audit({
      content: "Email: {{email_referente_cliente}}",
      runAi: false,
    });
    expect(report.deterministic.warnings).toContainEqual(
      expect.objectContaining({
        code: "MISSING_TYPE",
        placeholder: "{{email_referente_cliente}}",
        suggestion: "{{string:email_referente_cliente}}",
        autoFixable: false,
      }),
    );
  });

  it("emits EXTRA_PARAMETERS for invalid placeholder params", async () => {
    const report = await service.audit({
      content: "{{integer:durata_contratto_mesi:abc:true}}",
      runAi: false,
    });
    expect(report.deterministic.errors).toContainEqual(
      expect.objectContaining({
        code: "EXTRA_PARAMETERS",
        autoFixable: true,
      }),
    );
  });

  it("classifies a list without options as a syntax error, not unsupported type", async () => {
    const report = await service.audit({
      content: "{{list:priorita:100:true:Priorità:}}",
      runAi: false,
    });

    expect(report.deterministic.errors).toContainEqual(
      expect.objectContaining({
        code: "EXTRA_PARAMETERS",
        message: expect.stringContaining("list options are required"),
      }),
    );
    expect(report.deterministic.errors).not.toContainEqual(
      expect.objectContaining({ code: "UNSUPPORTED_TYPE" }),
    );
  });

  it("does not mark list:length malformed placeholder as auto-fixable", async () => {
    const report = await service.audit({
      content: "{{list:obiettivi:length:true:obiettivi}}",
      runAi: false,
    });
    expect(report.deterministic.errors).toContainEqual(
      expect.objectContaining({
        code: "EXTRA_PARAMETERS",
        autoFixable: false,
      }),
    );
  });

  it("detects duplicated markdown sections", async () => {
    const report = await service.audit({
      content: [
        "## Rischi",
        "{{text:rischi_principali}}",
        "## Rischi",
        "{{text:rischi_secondari}}",
      ].join("\n"),
      runAi: false,
    });
    expect(report.deterministic.warnings).toContainEqual(
      expect.objectContaining({
        code: "DUPLICATED_SECTION",
      }),
    );
  });

  it("warns when text placeholder is used inside markdown table", async () => {
    const report = await service.audit({
      content: [
        "| Voce | Dettaglio |",
        "| --- | --- |",
        "| Responsabilita | {{text:responsabilita_stakeholder_1}} |",
      ].join("\n"),
      runAi: false,
    });
    expect(report.deterministic.warnings).toContainEqual(
      expect.objectContaining({
        code: "TEXT_PLACEHOLDER_IN_TABLE",
        placeholder: "{{text:responsabilita_stakeholder_1}}",
      }),
    );
  });

  it("extracts table-adjacent semantic context and suggests date", async () => {
    const report = await service.audit({
      content: "| Data di nascita | {{string:data_nascita}} |",
      runAi: true,
    });
    expect(report.ai?.warnings).toContainEqual(
      expect.objectContaining({
        fieldName: "data_nascita",
        currentType: "string",
        suggestedType: "date",
      }),
    );
  });

  it("does not produce AI warnings on semantically correct template", async () => {
    const report = await service.audit({
      content: "Data di nascita: {{date:data_nascita}}",
      runAi: true,
    });
    expect(report.ai?.warnings ?? []).toEqual([]);
  });

  it("skips AI semantic review when syntax errors are present", async () => {
    const report = await service.audit({
      content: "Cliente: {{string:nome_cliente",
      runAi: true,
    });
    expect(report.ai).toEqual(
      expect.objectContaining({
        provider: "skipped",
        warnings: [],
        failed: true,
      }),
    );
  });

  it("does not call AiTemplateAuditorService when syntax errors exist", async () => {
    const aiAuditMock = jest.fn();
    const isolated = new TemplateAuditService(
      new TemplatePlaceholderService(),
      { auditTemplate: aiAuditMock } as unknown as AiTemplateAuditorService,
    );

    await isolated.audit({
      content: "Cliente: {{string:nome_cliente",
      runAi: true,
    });
    expect(aiAuditMock).not.toHaveBeenCalled();
  });
});
