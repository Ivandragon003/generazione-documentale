import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createReadStream, type ReadStream } from "node:fs";
import { access, mkdir, unlink, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { Inject, Injectable } from "@nestjs/common";
import { pdfConfig } from "../config/pdf.config";
import {
  DocumentRenderingService,
  type FieldValueMap,
} from "./document-rendering.service";

export interface PdfGenerationInput {
  title: string;
  content: string;
  fieldValues: FieldValueMap;
  strict: boolean;
}

// STORAGE_PATH should be resolved at request time, not module load
// to allow proper dependency injection and configuration

const sleep = (ms: number): Promise<void> =>
  new Promise((resolveSleep) => setTimeout(resolveSleep, ms));

const pdfServiceUrl = process.env.PDF_SERVICE_URL?.trim();

@Injectable()
export class PdfGenerationService {
  constructor(
    @Inject(DocumentRenderingService)
    private readonly documentRenderingService: DocumentRenderingService,
  ) {}

  private getStoragePath(): string {
    return resolve(pdfConfig.storagePath);
  }

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
      `colorlinks=${pdfConfig.colorLinks}`,
      "-V",
      `linkcolor=${pdfConfig.linkColor}`,
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

      process.on("error", (error: NodeJS.ErrnoException) => {
        clearTimeout(timer);
        if (error.code === "ENOENT") {
          rejectRun(
            new Error(
              `Pandoc non trovato al percorso: ${pdfConfig.pandocPath}. ` +
                "Assicurati che Pandoc sia installato nel sistema o nel container Docker.",
            ),
          );
        } else {
          rejectRun(
            new Error(
              `Errore avvio Pandoc (${pdfConfig.pandocPath}): ${error.message}`,
            ),
          );
        }
      });

      process.stdin.end(input, "utf8");
    });
  }

  private async runRemotePdfService(input: {
    markdown: string;
    title: string;
    author: string;
    outputPath: string;
  }): Promise<void> {
    if (!pdfServiceUrl) return;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), pdfConfig.timeoutMs);
    try {
      const response = await fetch(
        `${pdfServiceUrl.replace(/\/$/, "")}/generate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            markdown: input.markdown,
            title: input.title,
            author: input.author,
            options: {
              engine: pdfConfig.engine,
              paper: pdfConfig.paper,
              fontSize: pdfConfig.fontSize,
              marginTop: pdfConfig.marginTop,
              marginBottom: pdfConfig.marginBottom,
              marginLeft: pdfConfig.marginLeft,
              marginRight: pdfConfig.marginRight,
              mainFont: pdfConfig.mainFont,
              sansFont: pdfConfig.sansFont,
              monoFont: pdfConfig.monoFont,
              colorLinks: pdfConfig.colorLinks,
              linkColor: pdfConfig.linkColor,
            },
          }),
          signal: controller.signal,
        },
      );

      if (!response.ok) {
        throw new Error(
          `PDF service ${response.status}: ${(await response.text()).slice(0, 500)}`,
        );
      }

      const bytes = Buffer.from(await response.arrayBuffer());
      await writeFile(input.outputPath, bytes);
    } finally {
      clearTimeout(timeout);
    }
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

    await mkdir(this.getStoragePath(), { recursive: true });
    const filename = `${randomUUID()}.pdf`;
    const outputPath = join(this.getStoragePath(), filename);
    const args = this.buildPandocArgs(outputPath, title, author);

    if (pdfServiceUrl) {
      await this.runRemotePdfService({
        markdown: interpolated,
        title,
        author,
        outputPath,
      });
      return { filename, unresolvedFields: unresolved };
    }

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
    const filepath = join(this.getStoragePath(), filename);
    try {
      await access(filepath);
    } catch {
      throw new Error(`File PDF non trovato: ${filename}`);
    }
    return createReadStream(filepath);
  }

  async deletePdf(filename: string): Promise<void> {
    const filepath = join(this.getStoragePath(), filename);
    await unlink(filepath).catch(() => undefined);
  }
}
