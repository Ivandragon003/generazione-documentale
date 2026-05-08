import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createReadStream, type ReadStream } from "node:fs";
import { access, mkdir, unlink } from "node:fs/promises";
import { join, resolve } from "node:path";
import { Inject, Injectable } from "@nestjs/common";
import { pdfConfig } from "../config/pdf.config";
import { DocumentRenderingService } from "./document-rendering.service";

export interface PdfGenerationInput {
  title: string;
  content: string;
  fieldValues: Record<string, string | number | boolean | null>;
  strict: boolean;
}

const STORAGE_PATH = resolve(pdfConfig.storagePath);

const sleep = (ms: number): Promise<void> =>
  new Promise((resolveSleep) => setTimeout(resolveSleep, ms));

const escapeLatexInline = (value: string): string =>
  value.replace(/[\\{}$&#_%~^]/g, (char) => `\\${char}`);

@Injectable()
export class PdfGenerationService {
  constructor(
    @Inject(DocumentRenderingService)
    private readonly documentRenderingService: DocumentRenderingService,
  ) {}

  private buildPandocArgs(
    outputPath: string,
    title: string,
    author: string,
  ): string[] {
    return [
      "--from",
      "markdown+smart+pipe_tables",
      "--to",
      "pdf",
      "--pdf-engine",
      pdfConfig.engine,
      "--output",
      outputPath,
      `--metadata=title:${title}`,
      `--metadata=author:${author}`,
      "--metadata=lang:it",
      `--metadata=date:${new Intl.DateTimeFormat("it-IT").format(new Date())}`,
      "-V",
      `papersize=${pdfConfig.paper}`,
      "-V",
      `fontsize=${pdfConfig.fontSize}`,
      "-V",
      `geometry:top=${pdfConfig.marginTop},bottom=${pdfConfig.marginBottom},left=${pdfConfig.marginLeft},right=${pdfConfig.marginRight}`,
      "-V",
      `mainfont=${pdfConfig.mainFont}`,
      "-V",
      `sansfont=${pdfConfig.sansFont}`,
      "-V",
      `monofont=${pdfConfig.monoFont}`,
      "-V",
      `linestretch=${pdfConfig.lineStretch}`,
      "-V",
      "indent=false",
      "-V",
      "colorlinks=true",
      "-V",
      "linkcolor=NavyBlue",
      "-V",
      "urlcolor=RoyalBlue",
      "-V",
      `header-includes=\\usepackage{fancyhdr}\\usepackage{longtable,booktabs,array}\\pagestyle{fancy}\\fancyhf{}\\fancyhead[L]{\\small ${escapeLatexInline(title)}}\\fancyhead[R]{\\small \\today}\\fancyfoot[C]{\\thepage}\\renewcommand{\\headrulewidth}{0.4pt}`,
      "-V",
      "tables=true",
      "-",
    ];
  }

  private runPandoc(
    args: string[],
    input: string,
    timeoutMs: number,
  ): Promise<void> {
    return new Promise((resolveRun, rejectRun) => {
      const process = spawn(pdfConfig.pandocPath, args, {
        stdio: ["pipe", "pipe", "pipe"],
      });

      let stderr = "";
      let timedOut = false;

      const timer = setTimeout(() => {
        timedOut = true;
        process.kill("SIGKILL");
        rejectRun(new Error(`Pandoc timeout dopo ${timeoutMs}ms`));
      }, timeoutMs);

      process.stderr.on("data", (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      process.on("close", (code) => {
        clearTimeout(timer);
        if (timedOut) return;
        if (code === 0) {
          resolveRun();
          return;
        }
        rejectRun(new Error(`Pandoc exit ${code}: ${stderr.slice(0, 500)}`));
      });

      process.on("error", (error) => {
        clearTimeout(timer);
        rejectRun(
          new Error(
            `Pandoc non trovato (${pdfConfig.pandocPath}): ${error.message}`,
          ),
        );
      });

      process.stdin.end(input, "utf8");
    });
  }

  async generatePdf(document: PdfGenerationInput): Promise<{
    filename: string;
    unresolvedFields?: string[];
  }> {
    const title = document.title || "Documento";
    const author = "MAC Documents";
    const strict = document.strict ?? false;

    if (
      Buffer.byteLength(document.content, "utf8") > pdfConfig.maxMarkdownBytes
    ) {
      throw new Error(
        `Documento troppo grande (max ${pdfConfig.maxMarkdownBytes} bytes)`,
      );
    }

    const { result: interpolated, unresolved } =
      this.documentRenderingService.renderTemplate(
        document.content,
        document.fieldValues,
        strict,
      );

    await mkdir(STORAGE_PATH, { recursive: true });
    const filename = `${randomUUID()}.pdf`;
    const outputPath = join(STORAGE_PATH, filename);
    const args = this.buildPandocArgs(outputPath, title, author);

    let lastError: Error | undefined;
    for (let attempt = 0; attempt <= pdfConfig.retries; attempt++) {
      if (attempt > 0) await sleep(pdfConfig.retryDelayMs * attempt);
      try {
        await this.runPandoc(args, interpolated, pdfConfig.timeoutMs);
        return { filename, unresolvedFields: unresolved };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
      }
    }

    throw lastError ?? new Error("Errore generazione PDF");
  }

  async getPdfStream(filename: string): Promise<ReadStream> {
    const filepath = join(STORAGE_PATH, filename);
    try {
      await access(filepath);
    } catch {
      throw new Error(`File PDF non trovato: ${filename}`);
    }
    return createReadStream(filepath);
  }

  async deletePdf(filename: string): Promise<void> {
    const filepath = join(STORAGE_PATH, filename);
    await unlink(filepath).catch(() => undefined);
  }
}
