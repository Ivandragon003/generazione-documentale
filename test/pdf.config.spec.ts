/**
 * pdf.config.spec.ts
 *
 * Test completi per buildPdfConfig() con tutti i casi limite.
 */

const resetPdfConfigModule = () => jest.resetModules();

const buildWithEnv = async (env: Record<string, string | undefined>) => {
  for (const key of [
    "PDF_ENGINE",
    "PDF_PAPER",
    "PDF_FONT_SIZE",
    "PDF_MARGIN_TOP",
    "PDF_MARGIN_BOTTOM",
    "PDF_MARGIN_LEFT",
    "PDF_MARGIN_RIGHT",
    "PDF_MAIN_FONT",
    "PDF_SANS_FONT",
    "PDF_MONO_FONT",
    "PDF_LINE_STRETCH",
    "PANDOC_PATH",
    "STORAGE_PATH",
    "PDF_GENERATION_TIMEOUT_MS",
    "PDF_GENERATION_RETRIES",
    "PDF_GENERATION_RETRY_DELAY_MS",
    "MAX_PDF_MARKDOWN_BYTES",
  ]) {
    delete process.env[key];
  }

  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }

  resetPdfConfigModule();
  const mod = await import("../src/config/pdf.config");
  return mod.pdfConfig;
};

describe("pdf.config — buildPdfConfig()", () => {
  describe("valori di default (env non impostate)", () => {
    it("imposta engine = xelatex", async () => {
      const cfg = await buildWithEnv({});
      expect(cfg.engine).toBe("xelatex");
    });

    it("imposta paper = a4", async () => {
      const cfg = await buildWithEnv({});
      expect(cfg.paper).toBe("a4");
    });

    it("imposta fontSize = 11pt", async () => {
      const cfg = await buildWithEnv({});
      expect(cfg.fontSize).toBe("11pt");
    });

    it("imposta tutti i margini a 2.5cm", async () => {
      const cfg = await buildWithEnv({});
      expect(cfg.marginTop).toBe("2.5cm");
      expect(cfg.marginBottom).toBe("2.5cm");
      expect(cfg.marginLeft).toBe("2.5cm");
      expect(cfg.marginRight).toBe("2.5cm");
    });

    it("imposta lineStretch = 1.25", async () => {
      const cfg = await buildWithEnv({});
      expect(cfg.lineStretch).toBe(1.25);
    });

    it("imposta pandocPath = pandoc", async () => {
      const cfg = await buildWithEnv({});
      expect(cfg.pandocPath).toBe("pandoc");
    });

    it("imposta storagePath = ./storage/pdf", async () => {
      const cfg = await buildWithEnv({});
      expect(cfg.storagePath).toBe("./storage/pdf");
    });

    it("imposta timeoutMs = 120000", async () => {
      const cfg = await buildWithEnv({});
      expect(cfg.timeoutMs).toBe(120000);
    });

    it("imposta retries = 2", async () => {
      const cfg = await buildWithEnv({});
      expect(cfg.retries).toBe(2);
    });

    it("imposta retryDelayMs = 1000", async () => {
      const cfg = await buildWithEnv({});
      expect(cfg.retryDelayMs).toBe(1000);
    });

    it("imposta maxMarkdownBytes = 300000", async () => {
      const cfg = await buildWithEnv({});
      expect(cfg.maxMarkdownBytes).toBe(300000);
    });

    it("imposta mainFont = Liberation Serif", async () => {
      const cfg = await buildWithEnv({});
      expect(cfg.mainFont).toBe("Liberation Serif");
    });
  });

  describe("valori validi accettati", () => {
    it("PDF_ENGINE=lualatex", async () => {
      const cfg = await buildWithEnv({ PDF_ENGINE: "lualatex" });
      expect(cfg.engine).toBe("lualatex");
    });

    it("PDF_ENGINE=pdflatex", async () => {
      const cfg = await buildWithEnv({ PDF_ENGINE: "pdflatex" });
      expect(cfg.engine).toBe("pdflatex");
    });

    it("PDF_PAPER=letter", async () => {
      const cfg = await buildWithEnv({ PDF_PAPER: "letter" });
      expect(cfg.paper).toBe("letter");
    });

    it("PDF_PAPER=a3", async () => {
      const cfg = await buildWithEnv({ PDF_PAPER: "a3" });
      expect(cfg.paper).toBe("a3");
    });

    it("PDF_PAPER=A4 (uppercase normalizzato)", async () => {
      const cfg = await buildWithEnv({ PDF_PAPER: "A4" });
      expect(cfg.paper).toBe("a4");
    });

    it("PDF_FONT_SIZE=12pt", async () => {
      const cfg = await buildWithEnv({ PDF_FONT_SIZE: "12pt" });
      expect(cfg.fontSize).toBe("12pt");
    });

    it("PDF_MARGIN_TOP=30mm", async () => {
      const cfg = await buildWithEnv({ PDF_MARGIN_TOP: "30mm" });
      expect(cfg.marginTop).toBe("30mm");
    });

    it("PDF_MARGIN_LEFT=1in", async () => {
      const cfg = await buildWithEnv({ PDF_MARGIN_LEFT: "1in" });
      expect(cfg.marginLeft).toBe("1in");
    });

    it("PDF_LINE_STRETCH=1.5", async () => {
      const cfg = await buildWithEnv({ PDF_LINE_STRETCH: "1.5" });
      expect(cfg.lineStretch).toBe(1.5);
    });

    it("PDF_LINE_STRETCH=1.0 (limite inferiore incluso)", async () => {
      const cfg = await buildWithEnv({ PDF_LINE_STRETCH: "1.0" });
      expect(cfg.lineStretch).toBe(1.0);
    });

    it("PDF_LINE_STRETCH=2.0 (limite superiore incluso)", async () => {
      const cfg = await buildWithEnv({ PDF_LINE_STRETCH: "2.0" });
      expect(cfg.lineStretch).toBe(2.0);
    });

    it("PDF_GENERATION_TIMEOUT_MS=60000", async () => {
      const cfg = await buildWithEnv({ PDF_GENERATION_TIMEOUT_MS: "60000" });
      expect(cfg.timeoutMs).toBe(60000);
    });

    it("PDF_GENERATION_RETRIES=0 (zero ammesso)", async () => {
      const cfg = await buildWithEnv({ PDF_GENERATION_RETRIES: "0" });
      expect(cfg.retries).toBe(0);
    });

    it("PANDOC_PATH=/usr/local/bin/pandoc", async () => {
      const cfg = await buildWithEnv({ PANDOC_PATH: "/usr/local/bin/pandoc" });
      expect(cfg.pandocPath).toBe("/usr/local/bin/pandoc");
    });

    it("MAX_PDF_MARKDOWN_BYTES=500000", async () => {
      const cfg = await buildWithEnv({ MAX_PDF_MARKDOWN_BYTES: "500000" });
      expect(cfg.maxMarkdownBytes).toBe(500000);
    });
  });

  describe("fallback con valori invalidi (warn attivato)", () => {
    it("PDF_ENGINE invalido -> xelatex", async () => {
      const cfg = await buildWithEnv({ PDF_ENGINE: "pdftex" });
      expect(cfg.engine).toBe("xelatex");
    });

    it("PDF_PAPER invalido -> a4", async () => {
      const cfg = await buildWithEnv({ PDF_PAPER: "b5" });
      expect(cfg.paper).toBe("a4");
    });

    it("PDF_FONT_SIZE invalido -> 11pt", async () => {
      const cfg = await buildWithEnv({ PDF_FONT_SIZE: "13pt" });
      expect(cfg.fontSize).toBe("11pt");
    });

    it("PDF_MARGIN_TOP senza unita -> 2.5cm", async () => {
      const cfg = await buildWithEnv({ PDF_MARGIN_TOP: "25" });
      expect(cfg.marginTop).toBe("2.5cm");
    });

    it("PDF_MARGIN_BOTTOM con unita non supportata -> 2.5cm", async () => {
      const cfg = await buildWithEnv({ PDF_MARGIN_BOTTOM: "2.5px" });
      expect(cfg.marginBottom).toBe("2.5cm");
    });

    it("PDF_LINE_STRETCH fuori range (0.5) -> 1.25", async () => {
      const cfg = await buildWithEnv({ PDF_LINE_STRETCH: "0.5" });
      expect(cfg.lineStretch).toBe(1.25);
    });

    it("PDF_LINE_STRETCH fuori range (3.0) -> 1.25", async () => {
      const cfg = await buildWithEnv({ PDF_LINE_STRETCH: "3.0" });
      expect(cfg.lineStretch).toBe(1.25);
    });

    it("PDF_LINE_STRETCH=NaN -> 1.25", async () => {
      const cfg = await buildWithEnv({ PDF_LINE_STRETCH: "notanumber" });
      expect(cfg.lineStretch).toBe(1.25);
    });

    it("PDF_GENERATION_TIMEOUT_MS=0 -> 120000 (min=5000)", async () => {
      const cfg = await buildWithEnv({ PDF_GENERATION_TIMEOUT_MS: "0" });
      expect(cfg.timeoutMs).toBe(120000);
    });

    it("PDF_GENERATION_TIMEOUT_MS=4999 -> 120000 (sotto il minimo)", async () => {
      const cfg = await buildWithEnv({ PDF_GENERATION_TIMEOUT_MS: "4999" });
      expect(cfg.timeoutMs).toBe(120000);
    });

    it("PDF_GENERATION_TIMEOUT_MS negativo -> 120000", async () => {
      const cfg = await buildWithEnv({ PDF_GENERATION_TIMEOUT_MS: "-1" });
      expect(cfg.timeoutMs).toBe(120000);
    });

    it("PDF_GENERATION_RETRY_DELAY_MS=50 -> 1000 (min=100)", async () => {
      const cfg = await buildWithEnv({ PDF_GENERATION_RETRY_DELAY_MS: "50" });
      expect(cfg.retryDelayMs).toBe(1000);
    });

    it("MAX_PDF_MARKDOWN_BYTES=999 -> 300000 (min=1000)", async () => {
      const cfg = await buildWithEnv({ MAX_PDF_MARKDOWN_BYTES: "999" });
      expect(cfg.maxMarkdownBytes).toBe(300000);
    });

    it("PDF_GENERATION_TIMEOUT_MS=stringa vuota -> 120000", async () => {
      const cfg = await buildWithEnv({ PDF_GENERATION_TIMEOUT_MS: "" });
      expect(cfg.timeoutMs).toBe(120000);
    });

    it("PDF_GENERATION_RETRIES=float (1.5) -> 2", async () => {
      const cfg = await buildWithEnv({ PDF_GENERATION_RETRIES: "1.5" });
      expect(cfg.retries).toBe(2);
    });

    it("PDF_MARGIN_LEFT solo spazi -> 2.5cm", async () => {
      const cfg = await buildWithEnv({ PDF_MARGIN_LEFT: "   " });
      expect(cfg.marginLeft).toBe("2.5cm");
    });
  });

  describe("struttura della configurazione risultante", () => {
    it("ha tutte le chiavi obbligatorie", async () => {
      const cfg = await buildWithEnv({});
      const keys = [
        "engine",
        "paper",
        "fontSize",
        "marginTop",
        "marginBottom",
        "marginLeft",
        "marginRight",
        "mainFont",
        "sansFont",
        "monoFont",
        "lineStretch",
        "pandocPath",
        "storagePath",
        "timeoutMs",
        "retries",
        "retryDelayMs",
        "maxMarkdownBytes",
      ];
      for (const k of keys) {
        expect(cfg).toHaveProperty(k);
      }
    });

    it("lineStretch e un number (non stringa)", async () => {
      const cfg = await buildWithEnv({});
      expect(typeof cfg.lineStretch).toBe("number");
    });

    it("timeoutMs e un number (non stringa)", async () => {
      const cfg = await buildWithEnv({});
      expect(typeof cfg.timeoutMs).toBe("number");
    });
  });
});
