import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createReadStream, type ReadStream } from "node:fs";
import { access, mkdir, unlink, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { sha256Signature } from "../common/utils/signature.utils";
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

type PdfMode = "remote" | "local";

@Injectable()
export class PdfGenerationService {
  private readonly logger = new Logger(PdfGenerationService.name);
  private readonly nodeEnv = process.env.NODE_ENV?.trim().toLowerCase() ?? "";
  private readonly pdfServiceUrl = process.env.PDF_SERVICE_URL?.trim() ?? "";
  private readonly localFallbackRaw =
    process.env.ENABLE_LOCAL_PDF_FALLBACK?.trim().toLowerCase();

  constructor(
    @Inject(DocumentRenderingService)
    private readonly documentRenderingService: DocumentRenderingService,
  ) {}

  private isProduction(): boolean {
    return this.nodeEnv === "production";
  }

  private isLocalFallbackEnabled(): boolean {
    if (this.localFallbackRaw === "true") return true;
    if (this.localFallbackRaw === "false") return false;
    return !this.isProduction();
  }

  private resolvePdfMode(): PdfMode {
    if (this.pdfServiceUrl.length > 0) return "remote";
    if (this.isProduction()) {
      throw new Error(
        "PDF_SERVICE_URL is required in production. " +
          "Configure pdf-service or explicitly enable ENABLE_LOCAL_PDF_FALLBACK=true only for controlled debugging.",
      );
    }
    if (!this.isLocalFallbackEnabled()) {
      throw new Error(
        "PDF_SERVICE_URL is not configured and local fallback is disabled. " +
          "Set ENABLE_LOCAL_PDF_FALLBACK=true in development or configure PDF_SERVICE_URL.",
      );
    }
    return "local";
  }

  async onModuleInit(): Promise<void> {
    const mode = this.resolvePdfMode();
    if (mode === "remote") {
      this.logger.log(
        `PDF mode=remote service url=${this.pdfServiceUrl} env=${this.nodeEnv || "development"}`,
      );
      const health = await this.checkHealth();
      if (!health.ok) {
        throw new Error(health.error ?? "PDF service unavailable");
      }
    } else {
      this.logger.log(
        `PDF mode=local pandocPath=${pdfConfig.pandocPath} env=${this.nodeEnv || "development"} fallback=${this.isLocalFallbackEnabled()}`,
      );
      const health = await this.checkHealth();
      if (!health.ok) {
        throw new Error(health.error ?? "Pandoc unavailable");
      }
    }
  }

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
        rejectRun(new Error(`Pandoc timeout after ${timeoutMs}ms`));
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
              `Pandoc not found at path: ${pdfConfig.pandocPath}. ` +
                "Ensure Pandoc is installed on the system or in the Docker container.",
            ),
          );
        } else {
          rejectRun(
            new Error(
              `Pandoc startup error (${pdfConfig.pandocPath}): ${error.message}`,
            ),
          );
        }
      });

      process.stdin.end(input, "utf8");
    });
  }

  private checkLocalPandoc(): Promise<{
    ok: boolean;
    version?: string;
    error?: string;
  }> {
    return new Promise((resolveCheck) => {
      const process = spawn(pdfConfig.pandocPath, ["--version"], {
        stdio: ["ignore", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";
      process.stdout.on("data", (chunk: Buffer) => {
        stdout += chunk.toString();
      });
      process.stderr.on("data", (chunk: Buffer) => {
        stderr += chunk.toString();
      });
      process.on("error", (error: NodeJS.ErrnoException) => {
        if (error.code === "ENOENT") {
          resolveCheck({
            ok: false,
            error: `Pandoc not found at path: ${pdfConfig.pandocPath}`,
          });
          return;
        }
        resolveCheck({
          ok: false,
          error: `Pandoc startup error (${pdfConfig.pandocPath}): ${error.message}`,
        });
      });
      process.on("close", (code) => {
        if (code === 0) {
          resolveCheck({
            ok: true,
            version: (stdout.split(/\r?\n/)[0] ?? "").trim(),
          });
          return;
        }
        resolveCheck({
          ok: false,
          error: `Pandoc health check failed (${pdfConfig.pandocPath}): exit ${code} ${stderr.slice(0, 300)}`,
        });
      });
    });
  }

  async checkHealth(): Promise<{
    ok: boolean;
    mode: "remote" | "local";
    pandocPath?: string;
    version?: string;
    error?: string;
  }> {
    let mode: PdfMode;
    try {
      mode = this.resolvePdfMode();
    } catch (error) {
      return {
        ok: false,
        mode: this.pdfServiceUrl.length > 0 ? "remote" : "local",
        error: error instanceof Error ? error.message : String(error),
      };
    }
    if (mode === "local") {
      const local = await this.checkLocalPandoc();
      return { mode: "local", pandocPath: pdfConfig.pandocPath, ...local };
    }

    try {
      const response = await fetch(
        `${this.pdfServiceUrl.replace(/\/$/, "")}/health`,
      );
      const body = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        pandocPath?: string;
        version?: string;
        error?: string;
      };
      return {
        ok: response.ok && body.ok === true,
        mode: "remote",
        pandocPath: body.pandocPath,
        version: body.version,
        error: response.ok ? body.error : `PDF service ${response.status}`,
      };
    } catch (error) {
      return {
        ok: false,
        mode: "remote",
        error:
          error instanceof Error
            ? `PDF service unreachable: ${error.message}`
            : "PDF service unreachable",
      };
    }
  }

  private async runRemotePdfService(input: {
    markdown: string;
    title: string;
    author: string;
    outputPath: string;
  }): Promise<void> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), pdfConfig.timeoutMs);
    try {
      const response = await fetch(
        `${this.pdfServiceUrl.replace(/\/$/, "")}/generate`,
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
    renderedContentHash: string;
  }> {
    const title = document.title || "Document";
    const author = "MAC Documents";
    const strict = document.strict ?? false;

    if (
      Buffer.byteLength(document.content, "utf8") > pdfConfig.maxMarkdownBytes
    ) {
      throw new Error(
        `Document too large (max ${pdfConfig.maxMarkdownBytes} bytes)`,
      );
    }

    const { result: interpolated, unresolved } =
      this.documentRenderingService.renderTemplate(
        document.content,
        document.fieldValues,
        strict,
      );
    const renderedContentHash = sha256Signature(interpolated);

    await mkdir(this.getStoragePath(), { recursive: true });
    const filename = `${randomUUID()}.pdf`;
    const outputPath = join(this.getStoragePath(), filename);
    const args = this.buildPandocArgs(outputPath, title, author);

    if (this.resolvePdfMode() === "remote") {
      await this.runRemotePdfService({
        markdown: interpolated,
        title,
        author,
        outputPath,
      });
      return { filename, unresolvedFields: unresolved, renderedContentHash };
    }

    let lastError: Error | undefined;
    for (let attempt = 0; attempt <= pdfConfig.retries; attempt++) {
      if (attempt > 0) await sleep(pdfConfig.retryDelayMs * attempt);
      try {
        await this.runPandoc(args, interpolated, pdfConfig.timeoutMs);
        return { filename, unresolvedFields: unresolved, renderedContentHash };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
      }
    }

    throw lastError ?? new Error("PDF generation error");
  }

  async getPdfStream(filename: string): Promise<ReadStream> {
    const filepath = join(this.getStoragePath(), filename);
    try {
      await access(filepath);
    } catch {
      throw new Error(`PDF file not found: ${filename}`);
    }
    return createReadStream(filepath);
  }

  async deletePdf(filename: string): Promise<void> {
    const filepath = join(this.getStoragePath(), filename);
    await unlink(filepath).catch(() => undefined);
  }
}
