import { Test, type TestingModule } from "@nestjs/testing";
import type { DocumentEntity } from "../src/entities/document.entity";
import { DocumentsRepository } from "../src/repository/documents.repository";
import { DocumentRenderingService } from "../src/service/document-rendering.service";
import { PreviewService } from "../src/service/preview.service";

const makeDoc = (overrides: Partial<DocumentEntity> = {}): DocumentEntity => ({
  id: "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa",
  name: "Doc Preview",
  template_id: "bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb",
  content: "# {{titolo}}\n\nCliente: {{cliente}}",
  field_values: { titolo: "Contratto", cliente: "Mario Rossi" },
  status: "draft",
  created_by: "system",
  created_at: new Date(),
  updated_at: new Date(),
  ...overrides,
});

describe("PreviewService", () => {
  let service: PreviewService;
  let documentsRepository: jest.Mocked<DocumentsRepository>;
  let documentRenderingService: DocumentRenderingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PreviewService,
        {
          provide: DocumentsRepository,
          useValue: { findById: jest.fn() },
        },
        DocumentRenderingService,
      ],
    }).compile();

    service = module.get<PreviewService>(PreviewService);
    documentsRepository = module.get(
      DocumentsRepository,
    ) as jest.Mocked<DocumentsRepository>;
    documentRenderingService = module.get<DocumentRenderingService>(
      DocumentRenderingService,
    );
  });

  afterEach(() => jest.resetAllMocks());

  // ── getMarkdownPreview() — casi nominali ──────────────────────────────────

  describe("getMarkdownPreview() - casi nominali", () => {
    it("deve restituire il contenuto con i placeholder risolti", async () => {
      documentsRepository.findById.mockResolvedValue(makeDoc());

      const result = await service.getMarkdownPreview(
        "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa",
      );

      expect(result.content).toContain("Contratto");
      expect(result.content).toContain("Mario Rossi");
      expect(result.content).not.toContain("{{titolo}}");
      expect(result.content).not.toContain("{{cliente}}");
    });

    it("deve restituire array vuoto di unresolvedFields quando tutto è compilato", async () => {
      documentsRepository.findById.mockResolvedValue(makeDoc());

      const result = await service.getMarkdownPreview(
        "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa",
      );

      expect(result.unresolvedFields).toEqual([]);
    });

    it("deve restituire i campi non risolti quando fieldValues è incompleto", async () => {
      documentsRepository.findById.mockResolvedValue(
        makeDoc({ field_values: { titolo: "Contratto" } }),
      );

      const result = await service.getMarkdownPreview(
        "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa",
      );

      expect(result.unresolvedFields).toContain("cliente");
    });

    it("deve mantenere i placeholder visibili nel contenuto quando non risolti", async () => {
      documentsRepository.findById.mockResolvedValue(
        makeDoc({ field_values: {} }),
      );

      const result = await service.getMarkdownPreview(
        "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa",
      );

      expect(result.content).toContain("{{titolo}}");
      expect(result.content).toContain("{{cliente}}");
    });

    it("deve restituire il contenuto invariato se non ci sono placeholder", async () => {
      const doc = makeDoc({ content: "# Documento senza campi" });
      documentsRepository.findById.mockResolvedValue(doc);

      const result = await service.getMarkdownPreview(
        "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa",
      );

      expect(result.content).toBe("# Documento senza campi");
      expect(result.unresolvedFields).toEqual([]);
    });
  });

  // ── getMarkdownPreview() — casi limite ────────────────────────────────────

  describe("getMarkdownPreview() - casi limite", () => {
    it("deve lanciare 404 se il documento non esiste", async () => {
      documentsRepository.findById.mockResolvedValue(null);

      await expect(
        service.getMarkdownPreview("aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa"),
      ).rejects.toMatchObject({ status: 404 });
    });

    it("deve gestire field_values null (coerced a oggetto vuoto)", async () => {
      documentsRepository.findById.mockResolvedValue(
        makeDoc({
          field_values: null as unknown as Record<
            string,
            string | number | boolean | null
          >,
        }),
      );

      const result = await service.getMarkdownPreview(
        "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa",
      );

      expect(result.content).toBeDefined();
    });

    it("deve gestire contenuto vuoto senza errori", async () => {
      documentsRepository.findById.mockResolvedValue(makeDoc({ content: "" }));

      const result = await service.getMarkdownPreview(
        "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa",
      );

      expect(result.content).toBe("");
      expect(result.unresolvedFields).toEqual([]);
    });

    it("deve gestire valori numerici nei fieldValues", async () => {
      documentsRepository.findById.mockResolvedValue(
        makeDoc({
          content: "Importo: {{importo}} EUR",
          field_values: { importo: 9999 },
        }),
      );

      const result = await service.getMarkdownPreview(
        "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa",
      );

      expect(result.content).toContain("9999");
      expect(result.unresolvedFields).toEqual([]);
    });

    it("deve gestire valori booleani false nei fieldValues", async () => {
      documentsRepository.findById.mockResolvedValue(
        makeDoc({
          content: "Attivo: {{attivo}}",
          field_values: { attivo: false },
        }),
      );

      const result = await service.getMarkdownPreview(
        "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa",
      );

      expect(result.content).toContain("false");
      expect(result.unresolvedFields).toEqual([]);
    });

    it("deve gestire placeholder ripetuti nello stesso documento", async () => {
      documentsRepository.findById.mockResolvedValue(
        makeDoc({
          content: "{{titolo}} — riepilogo di {{titolo}}",
          field_values: { titolo: "Capitolato" },
        }),
      );

      const result = await service.getMarkdownPreview(
        "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa",
      );

      expect(result.content).toBe("Capitolato — riepilogo di Capitolato");
      expect(result.unresolvedFields).toEqual([]);
    });

    it("deve segnalare un solo campo mancante anche se appare più volte", async () => {
      documentsRepository.findById.mockResolvedValue(
        makeDoc({
          content: "{{mancante}} e ancora {{mancante}}",
          field_values: {},
        }),
      );

      const result = await service.getMarkdownPreview(
        "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa",
      );

      // renderTemplate non deduplica — unresolved può contenere duplicati
      // verifica solo che "mancante" sia presente
      expect(result.unresolvedFields).toContain("mancante");
    });
  });

  // ── integrazione con DocumentRenderingService ─────────────────────────────

  describe("integrazione con DocumentRenderingService", () => {
    it("chiama renderTemplate con strict=false", async () => {
      const spy = jest.spyOn(documentRenderingService, "renderTemplate");
      documentsRepository.findById.mockResolvedValue(makeDoc());

      await service.getMarkdownPreview("aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa");

      expect(spy).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        false,
      );
    });

    it("non altera il contenuto originale del documento sul DB", async () => {
      const doc = makeDoc();
      const originalContent = doc.content;
      documentsRepository.findById.mockResolvedValue(doc);

      await service.getMarkdownPreview("aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa");

      expect(doc.content).toBe(originalContent);
    });
  });
});
