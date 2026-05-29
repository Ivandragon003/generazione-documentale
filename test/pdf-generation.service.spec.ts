import { createReadStream, type ReadStream } from "node:fs";
import { access, mkdir, unlink } from "node:fs/promises";
import { Test, type TestingModule } from "@nestjs/testing";
import { DocumentRenderingService } from "../src/service/document-rendering.service";
import { PdfGenerationService } from "../src/service/pdf-generation.service";
import { TemplatePlaceholderService } from "../src/service/template-placeholder.service";

jest.mock("node:child_process", () => ({
  spawn: jest.fn(),
}));
jest.mock("node:fs/promises", () => ({
  access: jest.fn(),
  mkdir: jest.fn(),
  unlink: jest.fn(),
}));
jest.mock("node:fs", () => ({
  createReadStream: jest.fn(),
}));
jest.mock("node:crypto", () => ({
  ...jest.requireActual("node:crypto"),
  randomUUID: jest.fn(() => "test-uuid-1234"),
}));

import { type ChildProcess, spawn } from "node:child_process";

const spawnMock = spawn as jest.MockedFunction<typeof spawn>;
const accessMock = access as jest.MockedFunction<typeof access>;
const mkdirMock = mkdir as jest.MockedFunction<typeof mkdir>;
const unlinkMock = unlink as jest.MockedFunction<typeof unlink>;
const createReadStreamMock = createReadStream as jest.MockedFunction<
  typeof createReadStream
>;

// Tipo esplicito per il processo mockato — evita `any`
type MockChildProcess = {
  stdin: { end: jest.Mock };
  stderr: { on: jest.Mock };
  on: jest.Mock;
  kill: jest.Mock;
};

function makeSpawnMock(exitCode: number, stderrData = ""): MockChildProcess {
  const proc: MockChildProcess = {
    stdin: { end: jest.fn() },
    stderr: {
      on: jest.fn((event: string, cb: (d: Buffer) => void) => {
        if (event === "data" && stderrData) cb(Buffer.from(stderrData));
      }),
    },
    on: jest.fn((event: string, cb: (code: number) => void) => {
      if (event === "close") setTimeout(() => cb(exitCode), 0);
    }),
    kill: jest.fn(),
  };
  spawnMock.mockReturnValue(proc as unknown as ChildProcess);
  return proc;
}

describe("PdfGenerationService", () => {
  let service: PdfGenerationService;
  let renderingService: DocumentRenderingService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mkdirMock.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PdfGenerationService,
        DocumentRenderingService,
        TemplatePlaceholderService,
      ],
    }).compile();

    service = module.get<PdfGenerationService>(PdfGenerationService);
    renderingService = module.get<DocumentRenderingService>(
      DocumentRenderingService,
    );
    jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => jest.restoreAllMocks());

  describe("generatePdf()", () => {
    const baseInput = {
      title: "Test Doc",
      content: "# {{titolo}}\n\nContenuto del documento.",
      fieldValues: { titolo: "Titolo Test" },
      strict: false,
    };

    it("deve generare un PDF e restituire il filename", async () => {
      makeSpawnMock(0);
      const result = await service.generatePdf(baseInput);
      expect(result.filename).toBe("test-uuid-1234.pdf");
      expect(result.unresolvedFields).toEqual([]);
      expect(mkdirMock).toHaveBeenCalled();
      expect(spawnMock).toHaveBeenCalled();
    });

    it("deve includere campi non risolti nel risultato", async () => {
      makeSpawnMock(0);
      const result = await service.generatePdf({
        ...baseInput,
        content: "# {{titolo}}\n\n{{campo_mancante}}",
        fieldValues: { titolo: "Test" },
        strict: false,
      });
      expect(result.unresolvedFields).toContain("campo_mancante");
    });

    it("deve usare strict mode quando specificato", async () => {
      makeSpawnMock(0);
      const spy = jest.spyOn(renderingService, "renderTemplate");
      await service.generatePdf({ ...baseInput, strict: true });
      expect(spy).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        true,
      );
    });

    it("non deve iniettare metadati title/author/date nel documento", async () => {
      makeSpawnMock(0);
      await service.generatePdf({ ...baseInput, title: "" });
      const callArgs = spawnMock.mock.calls[0][1] as string[];
      expect(
        callArgs.some((a: string) => a.startsWith("--metadata=title:")),
      ).toBe(false);
      expect(
        callArgs.some((a: string) => a.startsWith("--metadata=author:")),
      ).toBe(false);
      expect(
        callArgs.some((a: string) => a.startsWith("--metadata=date:")),
      ).toBe(false);
    });

    it("deve usare profilo rtl per contenuto arabo", async () => {
      makeSpawnMock(0);
      await service.generatePdf({
        ...baseInput,
        content: "# عرض تجاري\n\nاسم العميل: {{titolo}}",
      });
      const callArgs = spawnMock.mock.calls[0][1] as string[];
      expect(callArgs).toContain("--metadata=lang:ar");
      expect(callArgs).toContain("--metadata=dir:rtl");
      expect(callArgs).toContain("-V");
      expect(callArgs).toContain("mainfont=DejaVu Sans");
    });

    it("deve usare profilo cjk per contenuto giapponese/cinese", async () => {
      makeSpawnMock(0);
      await service.generatePdf({
        ...baseInput,
        content: "# 技術会議議事録\n\n顧客名: {{titolo}}",
      });
      const callArgs = spawnMock.mock.calls[0][1] as string[];
      expect(
        callArgs.includes("--metadata=lang:ja") ||
          callArgs.includes("--metadata=lang:zh"),
      ).toBe(true);
      expect(callArgs).toContain("CJKmainfont=Noto Sans CJK JP");
      expect(callArgs).toContain("mainfont=Noto Sans");
    });

    it("deve usare fallback latin per contenuto europeo", async () => {
      makeSpawnMock(0);
      await service.generatePdf({
        ...baseInput,
        content: "# Offerta commerciale\n\nCliente: {{titolo}}",
      });
      const callArgs = spawnMock.mock.calls[0][1] as string[];
      expect(callArgs).toContain("--metadata=lang:en");
      expect(callArgs).toContain("--metadata=dir:ltr");
      expect(callArgs).toContain("mainfont=Noto Sans");
    });

    it("usa la lingua del browser quando fornita", async () => {
      makeSpawnMock(0);
      await service.generatePdf({
        ...baseInput,
        language: "ja-JP",
      });
      const callArgs = spawnMock.mock.calls[0][1] as string[];
      expect(callArgs).toContain("--metadata=lang:ja-JP");
      expect(callArgs).toContain("CJKmainfont=Noto Sans CJK JP");
    });

    it("deve lanciare un errore se il contenuto supera il limite massimo", async () => {
      const hugeContent = "A".repeat(600000);
      await expect(
        service.generatePdf({ ...baseInput, content: hugeContent }),
      ).rejects.toThrow(/too large/);
    });

    it("deve validare i valori rispetto ai tipi placeholder", async () => {
      await expect(
        service.generatePdf({
          ...baseInput,
          content: "# {{currency:importo_base}}",
          fieldValues: { importo_base: "non numerico" },
        }),
      ).rejects.toThrow(/field values validation failed/);
      expect(spawnMock).not.toHaveBeenCalled();
    });

    it("deve fallire se un placeholder typed required non e valorizzato", async () => {
      await expect(
        service.generatePdf({
          ...baseInput,
          content: "# {{string:titolo}}\n\nCliente: {{text:cliente}}",
          fieldValues: { titolo: "Offerta" },
          strict: false,
        }),
      ).rejects.toThrow(
        /Required template fields are unresolved: cliente \(type=text, required=true, reason=missing\)/,
      );
      expect(spawnMock).not.toHaveBeenCalled();
    });

    it("deve includere suggerimento per required typed non risolto da typo fieldValues", async () => {
      await expect(
        service.generatePdf({
          ...baseInput,
          content: "# {{string:nome_cliente}}",
          fieldValues: { nome_clietne: "ACME" },
          strict: false,
        }),
      ).rejects.toThrow(/suggestedField=nome_cliente/);
      expect(spawnMock).not.toHaveBeenCalled();
    });

    it("mantiene non bloccanti i placeholder legacy untyped mancanti", async () => {
      makeSpawnMock(0);
      const result = await service.generatePdf({
        ...baseInput,
        content: "# {{titolo}}\n\nCliente: {{cliente}}",
        fieldValues: { titolo: "Offerta" },
        strict: false,
      });
      expect(result.unresolvedFields).toEqual(["cliente"]);
      expect(spawnMock).toHaveBeenCalled();
    });

    it("deve lanciare errore se pandoc esce con codice non-zero", async () => {
      makeSpawnMock(1, "Errore LaTeX");
      await expect(service.generatePdf(baseInput)).rejects.toThrow(
        /Pandoc exit 1/,
      );
    });

    it("deve lanciare errore se pandoc emette evento error", async () => {
      const proc: MockChildProcess = {
        stdin: { end: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn(
          (event: string, cb: (err?: NodeJS.ErrnoException) => void) => {
            if (event === "error") {
              const err = new Error("ENOENT") as NodeJS.ErrnoException;
              err.code = "ENOENT";
              setTimeout(() => cb(err), 0);
            }
          },
        ),
        kill: jest.fn(),
      };
      spawnMock.mockReturnValue(proc as unknown as ChildProcess);
      await expect(service.generatePdf(baseInput)).rejects.toThrow(
        /Pandoc not found/,
      );
    });

    it("deve ritentare in caso di fallimento e poi fallire", async () => {
      makeSpawnMock(1);
      await expect(service.generatePdf(baseInput)).rejects.toThrow();
      expect(spawnMock.mock.calls.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("getPdfStream()", () => {
    it("deve restituire uno stream se il file esiste", async () => {
      accessMock.mockResolvedValue(undefined);
      const fakeStream = {} as ReadStream;
      createReadStreamMock.mockReturnValue(fakeStream);
      const result = await service.getPdfStream("test-uuid-1234.pdf");
      expect(result).toBe(fakeStream);
    });

    it("deve lanciare errore se il file non esiste", async () => {
      accessMock.mockRejectedValue(new Error("ENOENT"));
      await expect(service.getPdfStream("nonexistent.pdf")).rejects.toThrow(
        /PDF file not found/,
      );
    });
  });

  describe("deletePdf()", () => {
    it("deve eliminare il file PDF", async () => {
      unlinkMock.mockResolvedValue(undefined);
      await expect(
        service.deletePdf("test-uuid-1234.pdf"),
      ).resolves.not.toThrow();
      expect(unlinkMock).toHaveBeenCalled();
    });

    it("deve ignorare l'errore se il file non esiste", async () => {
      unlinkMock.mockRejectedValue(new Error("ENOENT"));
      await expect(service.deletePdf("nonexistent.pdf")).resolves.not.toThrow();
    });
  });
});
