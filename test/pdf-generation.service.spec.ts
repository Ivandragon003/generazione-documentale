import { Test, type TestingModule } from "@nestjs/testing";
import { access, mkdir, unlink } from "node:fs/promises";
import { createReadStream, type ReadStream } from "node:fs";
import { PdfGenerationService } from "../src/service/pdf-generation.service";
import { DocumentRenderingService } from "../src/service/document-rendering.service";
import type { ChildProcess } from "node:child_process";

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
  randomUUID: jest.fn(() => "test-uuid-1234"),
}));

import { spawn } from "node:child_process";
const spawnMock = spawn as jest.MockedFunction<typeof spawn>;
const accessMock = access as jest.MockedFunction<typeof access>;
const mkdirMock = mkdir as jest.MockedFunction<typeof mkdir>;
const unlinkMock = unlink as jest.MockedFunction<typeof unlink>;
const createReadStreamMock = createReadStream as jest.MockedFunction<typeof createReadStream>;

// Tipo esplicito per il processo mockato — evita `any`
type MockChildProcess = Pick<ChildProcess, "stdin" | "stderr" | "on" | "kill"> & {
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
      providers: [PdfGenerationService, DocumentRenderingService],
    }).compile();

    service = module.get<PdfGenerationService>(PdfGenerationService);
    renderingService = module.get<DocumentRenderingService>(DocumentRenderingService);
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
      expect(spy).toHaveBeenCalledWith(expect.any(String), expect.any(Object), true);
    });

    it("deve usare 'Documento' come titolo di default se non fornito", async () => {
      makeSpawnMock(0);
      await service.generatePdf({ ...baseInput, title: "" });
      const callArgs = spawnMock.mock.calls[0][1] as string[];
      expect(callArgs.some((a: string) => a.includes("Documento"))).toBe(true);
    });

    it("deve lanciare un errore se il contenuto supera il limite massimo", async () => {
      const hugeContent = "A".repeat(600000);
      await expect(
        service.generatePdf({ ...baseInput, content: hugeContent }),
      ).rejects.toThrow(/troppo grande/);
    });

    it("deve lanciare errore se pandoc esce con codice non-zero", async () => {
      makeSpawnMock(1, "Errore LaTeX");
      await expect(service.generatePdf(baseInput)).rejects.toThrow(/Pandoc exit 1/);
    });

    it("deve lanciare errore se pandoc emette evento error", async () => {
      const proc: MockChildProcess = {
        stdin: { end: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn((event: string, cb: (err?: Error) => void) => {
          if (event === "error") setTimeout(() => cb(new Error("ENOENT")), 0);
        }),
        kill: jest.fn(),
      };
      spawnMock.mockReturnValue(proc as unknown as ChildProcess);
      await expect(service.generatePdf(baseInput)).rejects.toThrow(/Pandoc non trovato/);
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
        /File PDF non trovato/,
      );
    });
  });

  describe("deletePdf()", () => {
    it("deve eliminare il file PDF", async () => {
      unlinkMock.mockResolvedValue(undefined);
      await expect(service.deletePdf("test-uuid-1234.pdf")).resolves.not.toThrow();
      expect(unlinkMock).toHaveBeenCalled();
    });

    it("deve ignorare l'errore se il file non esiste", async () => {
      unlinkMock.mockRejectedValue(new Error("ENOENT"));
      await expect(service.deletePdf("nonexistent.pdf")).resolves.not.toThrow();
    });
  });
});
