import type { Response } from "express";
import { TemplatesController } from "../src/controller/templates.controller";
import type { AuditLogsService } from "../src/service/audit-logs.service";
import type { GitTemplateVersioningService } from "../src/service/git-template-versioning.service";
import type { PdfGenerationService } from "../src/service/pdf-generation.service";
import type { PdfJobsService } from "../src/service/pdf-jobs.service";
import type { TemplateAuditService } from "../src/service/template-audit.service";
import type { TemplateDraftGenerationService } from "../src/service/template-draft-generation.service";
import type { TemplateFieldListsService } from "../src/service/template-field-lists.service";
import type { TemplatesService } from "../src/service/templates.service";
import type { TenantProvider } from "../src/service/tenant-provider.service";

describe("TemplatesController", () => {
  const templatesService = {
    create: jest.fn(),
    update: jest.fn(),
  } as unknown as TemplatesService;
  const pdfJobsService = {
    streamLatest: jest.fn(),
    streamDownload: jest.fn(),
  } as unknown as PdfJobsService;
  const pdfGenerationService = {
    generateDocx: jest.fn(),
  } as unknown as PdfGenerationService;
  const templateVersioning = {} as GitTemplateVersioningService;
  const tenantProvider = {} as TenantProvider;
  const templateFieldListsService = {} as TemplateFieldListsService;
  const auditLogsService = {} as AuditLogsService;
  const templateAuditService = {
    audit: jest.fn().mockResolvedValue({
      deterministic: { errors: [], warnings: [], fields: [], durationMs: 1 },
      ai: {
        warnings: [
          {
            fieldName: "data_nascita",
            currentType: "string",
            suggestedType: "date",
            reason: "Il contesto suggerisce un valore temporale.",
            confidence: 0.8,
            severity: "warning",
          },
        ],
        provider: "mock",
        model: "mock",
        latencyMs: 1,
      },
    }),
  } as unknown as TemplateAuditService;
  const templateDraftGenerationService = {
    generateDraft: jest.fn().mockResolvedValue({
      content: "# Bozza\n\nCliente: {{string:nome_cliente}}",
      fields: [{ name: "nome_cliente", type: "string", line: 3 }],
      placeholderAnalysis: {
        extractedFields: [
          {
            raw: "{{string:nome_cliente}}",
            type: "string",
            name: "nome_cliente",
          },
        ],
        validFields: [
          {
            raw: "{{string:nome_cliente}}",
            type: "string",
            name: "nome_cliente",
          },
        ],
        invalidPlaceholders: [],
        syntaxErrors: [],
        unsupportedTypes: [],
        duplicatedPlaceholders: [],
        placeholdersInTitles: [],
        truncatedOutputErrors: [],
        nonExtractedInvalidPlaceholders: [],
        repairableErrors: [],
        nonRepairableErrors: [],
        repairableErrorsAvailable: false,
        repairApplied: false,
        blockingErrorsAfterRepair: 0,
      },
      deterministic: {
        errors: [],
        warnings: [],
        durationMs: 2,
      },
      semanticAudit: {
        warnings: [],
      },
      ai: {
        provider: "mock",
        model: "mock-template-draft-v1",
        latencyMs: 3,
        failed: false,
        error: null,
      },
      benchmark: {
        model: "mock-template-draft-v1",
        numPredict: null,
        temperature: null,
        auditEnabled: false,
        generationDurationMs: 3,
        outputLength: 40,
        syntaxErrorCount: 0,
        syntaxErrorTypes: [],
        outputComplete: true,
        validationPassed: true,
        repairApplied: false,
      },
      evaluation: {
        syntaxValidity: { valid: true, issues: [] },
        structuralCompleteness: { valid: true, issues: [] },
        semanticQuality: { valid: true, issues: [] },
        promptConformity: { valid: true, issues: [] },
      },
      repair: {
        applied: false,
        changes: [],
        errorsBeforeRepair: 0,
        repairableErrorsAvailable: false,
        repairAppliedCount: 0,
        repairedPlaceholders: [],
        errorsAfterRepair: 0,
        blockingErrorsAfterRepair: 0,
        finalValidationPassed: true,
      },
      savable: true,
    }),
    repairDraft: jest.fn().mockResolvedValue({
      content: "# Bozza\n\nCliente: {{string:nome_cliente}}",
      fields: [{ name: "nome_cliente", type: "string", line: 3 }],
      placeholderAnalysis: {
        extractedFields: [
          {
            raw: "{{string:nome_cliente}}",
            type: "string",
            name: "nome_cliente",
          },
        ],
        validFields: [
          {
            raw: "{{string:nome_cliente}}",
            type: "string",
            name: "nome_cliente",
          },
        ],
        invalidPlaceholders: [],
        syntaxErrors: [],
        unsupportedTypes: [],
        duplicatedPlaceholders: [],
        placeholdersInTitles: [],
        truncatedOutputErrors: [],
        nonExtractedInvalidPlaceholders: [],
        repairableErrors: [],
        nonRepairableErrors: [],
        repairableErrorsAvailable: true,
        repairApplied: true,
        blockingErrorsAfterRepair: 0,
      },
      deterministic: {
        errors: [],
        warnings: [],
        durationMs: 2,
      },
      semanticAudit: {
        warnings: [],
      },
      ai: {
        provider: "mock",
        model: null,
        latencyMs: 0,
        failed: false,
        error: null,
      },
      benchmark: {
        model: null,
        numPredict: null,
        temperature: null,
        auditEnabled: false,
        generationDurationMs: 0,
        outputLength: 40,
        syntaxErrorCount: 0,
        syntaxErrorTypes: [],
        outputComplete: true,
        validationPassed: true,
        repairApplied: true,
        syntaxSpecIncluded: true,
        syntaxSpecVersion: "template-syntax-spec-v1",
        parserVersion: null,
        generationMode: "guided",
      },
      evaluation: {
        syntaxValidity: { valid: true, issues: [] },
        structuralCompleteness: { valid: true, issues: [] },
        semanticQuality: { valid: true, issues: [] },
        promptConformity: { valid: true, issues: [] },
      },
      repair: {
        applied: true,
        changes: ["field_name:unità_responsabile->unita_responsabile"],
        errorsBeforeRepair: 1,
        repairableErrorsAvailable: true,
        repairAppliedCount: 1,
        repairedPlaceholders: ["field_name:unità_responsabile"],
        errorsAfterRepair: 0,
        blockingErrorsAfterRepair: 0,
        finalValidationPassed: true,
      },
      savable: true,
    }),
  } as unknown as TemplateDraftGenerationService;

  const controller = new TemplatesController(
    templatesService,
    pdfJobsService,
    pdfGenerationService,
    templateVersioning,
    tenantProvider,
    templateFieldListsService,
    auditLogsService,
    templateAuditService,
    templateDraftGenerationService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 400 for malformed fieldValues query on /pdf/latest", async () => {
    const response = {} as Response;

    await expect(
      controller.downloadLatestPdf(
        "github:cat/sec/name",
        "{invalid",
        undefined,
        response,
      ),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("accepts valid fieldValues query and calls streamLatest", async () => {
    const response = {} as Response;

    await controller.downloadLatestPdf(
      "github:cat/sec/name",
      JSON.stringify({ title: "ok" }),
      "en-US",
      response,
    );

    expect((pdfJobsService.streamLatest as jest.Mock).mock.calls[0]).toEqual([
      "github:cat/sec/name",
      response,
      { title: "ok" },
      "en-US",
    ]);
  });

  it("calls streamDownload for /pdf/jobs/:jobId/download", async () => {
    const response = {} as Response;
    const jobId = "456e7890-e89b-12d3-a456-426614174001";

    await controller.downloadPdfJob(
      "github:cat/sec/name",
      jobId,
      undefined,
      response,
    );

    expect((pdfJobsService.streamDownload as jest.Mock).mock.calls[0]).toEqual([
      "github:cat/sec/name",
      jobId,
      response,
    ]);
  });

  it("scopes unqualified download template ids with tenantUuid", async () => {
    const response = {} as Response;
    const jobId = "456e7890-e89b-12d3-a456-426614174001";

    await controller.downloadPdfJob(
      "cat/sec/name",
      jobId,
      "11111111-1111-1111-1111-111111111111",
      response,
    );

    expect((pdfJobsService.streamDownload as jest.Mock).mock.calls[0]).toEqual([
      "github:11111111-1111-1111-1111-111111111111/cat/sec/name",
      jobId,
      response,
    ]);
  });

  it("returns structured audit report from /templates/audit", async () => {
    const result = await controller.auditTemplate({
      content: "Cliente: {{string:nome_cliente}}",
      runAi: true,
    });
    expect((templateAuditService.audit as jest.Mock).mock.calls[0][0]).toEqual({
      content: "Cliente: {{string:nome_cliente}}",
      runAi: true,
    });
    expect(result).toEqual(
      expect.objectContaining({
        deterministic: expect.objectContaining({
          errors: expect.any(Array),
          warnings: expect.any(Array),
          durationMs: expect.any(Number),
        }),
        ai: expect.objectContaining({
          warnings: expect.arrayContaining([
            expect.objectContaining({
              fieldName: "data_nascita",
              currentType: "string",
              suggestedType: "date",
              reason: expect.any(String),
              confidence: expect.any(Number),
            }),
          ]),
        }),
      }),
    );
    expect(
      "fields" in
        (
          result as {
            deterministic: Record<string, unknown>;
          }
        ).deterministic,
    ).toBe(false);
  });

  it("returns draft generation report from /templates/generate-draft", async () => {
    const result = await controller.generateDraft({
      description: "Offerta commerciale per servizi software",
      language: "it",
      runSemanticAudit: false,
    });

    expect(
      (templateDraftGenerationService.generateDraft as jest.Mock).mock
        .calls[0]?.[0],
    ).toEqual({
      description: "Offerta commerciale per servizi software",
      language: "it",
      runSemanticAudit: false,
      generationMode: "guided",
      autoRepair: false,
      defaultLength: undefined,
    });
    expect(result).toEqual(
      expect.objectContaining({
        content: expect.any(String),
        fields: expect.any(Array),
        deterministic: expect.objectContaining({
          errors: expect.any(Array),
          warnings: expect.any(Array),
        }),
        ai: expect.objectContaining({
          provider: expect.any(String),
          latencyMs: expect.any(Number),
        }),
        savable: expect.any(Boolean),
      }),
    );
  });

  it("does not save templates or trigger PDF/DOCX during draft generation", async () => {
    await controller.generateDraft({
      description: "Scheda anagrafica cliente",
      language: "it",
      runSemanticAudit: true,
    });

    expect(templatesService.create as jest.Mock).not.toHaveBeenCalled();
    expect(templatesService.update as jest.Mock).not.toHaveBeenCalled();
    expect(
      pdfGenerationService.generateDocx as jest.Mock,
    ).not.toHaveBeenCalled();
    expect(pdfJobsService.streamLatest as jest.Mock).not.toHaveBeenCalled();
    expect(pdfJobsService.streamDownload as jest.Mock).not.toHaveBeenCalled();
  });

  it("runs backend safe repair and returns revalidated report", async () => {
    const result = await controller.repairDraft({
      content: "{{string:unità_responsabile}}",
      defaultLength: 100,
    });
    expect(
      (templateDraftGenerationService.repairDraft as jest.Mock).mock
        .calls[0]?.[0],
    ).toEqual({
      content: "{{string:unità_responsabile}}",
      language: undefined,
      runSemanticAudit: false,
      generationMode: "guided",
      defaultLength: 100,
    });
    expect(result.repair?.applied).toBe(true);
  });
});
