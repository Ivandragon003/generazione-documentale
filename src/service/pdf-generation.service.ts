import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createReadStream, type ReadStream } from "node:fs";
import { access, mkdir, unlink, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { determinePdfScriptProfileFromLanguage } from "../common/utils/pdf-script-profile.utils";
import { sha256Signature } from "../common/utils/signature.utils";
import { pdfConfig } from "../config/pdf.config";
import {
  DocumentRenderingService,
  type FieldValueMap,
} from "./document-rendering.service";
import { TemplatePlaceholderService } from "./template-placeholder.service";

export interface PdfGenerationInput {
  title: string;
  content: string;
  fieldValues: FieldValueMap;
  strict: boolean;
  language?: string;
}
export type DocumentFormat = "pdf" | "docx";

// STORAGE_PATH should be resolved at request time, not module load
// to allow proper dependency injection and configuration

const sleep = (ms: number): Promise<void> =>
  new Promise((resolveSleep) => setTimeout(resolveSleep, ms));

type PdfMode = "remote" | "local";
const ARABIC_CHAR_REGEX = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/;
const HEBREW_CHAR_REGEX = /[\u0590-\u05FF]/;
const JAPANESE_CHAR_REGEX = /[\u3040-\u30FF\u31F0-\u31FF]/;
const CJK_IDEOGRAPH_REGEX = /[\u3400-\u4DBF\u4E00-\u9FFF]/;
const HANGUL_CHAR_REGEX = /[\uAC00-\uD7AF\u1100-\u11FF]/;

interface PdfResolvedProfile {
  language: string;
  scriptProfile: "latin" | "rtl" | "cjk";
  lang: string;
  dir: "ltr" | "rtl";
  mainFont: string;
  cjkMainFont: string;
  mainFontFallbacks: string[];
}

interface PandocArgsInput {
  outputPath: string;
  format: DocumentFormat;
  lang: string;
  dir: "ltr" | "rtl";
  mainFont: string;
  cjkMainFont: string;
  mainFontFallbacks: string[];
}

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
    @Inject(TemplatePlaceholderService)
    private readonly templatePlaceholderService: TemplatePlaceholderService,
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

  private detectLanguageFromMarkdown(markdown: string): string {
    if (ARABIC_CHAR_REGEX.test(markdown)) return "ar";
    if (HEBREW_CHAR_REGEX.test(markdown)) return "he";
    if (JAPANESE_CHAR_REGEX.test(markdown)) return "ja";
    if (HANGUL_CHAR_REGEX.test(markdown)) return "ko";
    if (CJK_IDEOGRAPH_REGEX.test(markdown)) return "zh";
    return "en";
  }

  private resolveDocumentProfile(
    markdown: string,
    browserLanguage?: string,
  ): PdfResolvedProfile {
    const language =
      browserLanguage?.trim() || this.detectLanguageFromMarkdown(markdown);
    const scriptProfile = determinePdfScriptProfileFromLanguage(language);
    const hasRtlScript =
      ARABIC_CHAR_REGEX.test(markdown) || HEBREW_CHAR_REGEX.test(markdown);
    const hasCjkScript =
      JAPANESE_CHAR_REGEX.test(markdown) ||
      CJK_IDEOGRAPH_REGEX.test(markdown) ||
      HANGUL_CHAR_REGEX.test(markdown);
    if (scriptProfile === "rtl") {
      const rtlFont = "DejaVu Sans";
      return {
        language,
        scriptProfile,
        lang: language,
        dir: "rtl",
        mainFont: rtlFont,
        cjkMainFont: pdfConfig.cjkMainFont,
        mainFontFallbacks: hasCjkScript
          ? ["Noto Sans CJK JP", "Noto Sans"]
          : ["Noto Sans"],
      };
    }

    if (scriptProfile === "cjk") {
      let mainFontFallbacks: string[] = ["Noto Sans"];
      if (hasRtlScript) {
        mainFontFallbacks = ["Noto Naskh Arabic", "Noto Sans"];
      }
      return {
        language,
        scriptProfile,
        lang: language,
        dir: "ltr",
        mainFont: "Noto Sans",
        cjkMainFont: "Noto Sans CJK JP",
        mainFontFallbacks,
      };
    }

    let mainFontFallbacks: string[] = [];
    if (hasRtlScript) {
      mainFontFallbacks = ["Noto Naskh Arabic", "Noto Sans CJK JP"];
    } else if (hasCjkScript) {
      mainFontFallbacks = ["Noto Sans CJK JP"];
    }
    return {
      language,
      scriptProfile,
      lang: language,
      dir: "ltr",
      mainFont: "Noto Sans",
      cjkMainFont: pdfConfig.cjkMainFont,
      mainFontFallbacks,
    };
  }

  private buildPandocArgs(input: PandocArgsInput): string[] {
    const {
      outputPath,
      format,
      lang,
      dir,
      mainFont,
      cjkMainFont,
      mainFontFallbacks,
    } = input;
    const fallbackArgs = mainFontFallbacks.flatMap((font) => [
      "-V",
      `mainfontfallback=${font}`,
    ]);
    const pdfEngineArgs: string[] = [];
    if (format === "pdf") {
      pdfEngineArgs.push("--pdf-engine", pdfConfig.engine);
    }
    return [
      "--from",
      "markdown+smart+pipe_tables",
      "--to",
      format,
      ...pdfEngineArgs,
      "--output",
      outputPath,
      `--metadata=lang:${lang}`,
      `--metadata=dir:${dir}`,
      "-V",
      `papersize=${pdfConfig.paper}`,
      "-V",
      `fontsize=${pdfConfig.fontSize}`,
      "-V",
      `geometry:top=${pdfConfig.marginTop},bottom=${pdfConfig.marginBottom},left=${pdfConfig.marginLeft},right=${pdfConfig.marginRight}`,
      "-V",
      `mainfont=${mainFont}`,
      "-V",
      `sansfont=${pdfConfig.sansFont}`,
      "-V",
      `monofont=${pdfConfig.monoFont}`,
      "-V",
      `CJKmainfont=${cjkMainFont}`,
      ...fallbackArgs,
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
    outputPath: string;
    format: DocumentFormat;
    lang: string;
    dir: "ltr" | "rtl";
    mainFont: string;
    cjkMainFont: string;
    mainFontFallbacks: string[];
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
            options: {
              engine: pdfConfig.engine,
              paper: pdfConfig.paper,
              fontSize: pdfConfig.fontSize,
              marginTop: pdfConfig.marginTop,
              marginBottom: pdfConfig.marginBottom,
              marginLeft: pdfConfig.marginLeft,
              marginRight: pdfConfig.marginRight,
              mainFont: input.mainFont,
              sansFont: pdfConfig.sansFont,
              monoFont: pdfConfig.monoFont,
              cjkMainFont: input.cjkMainFont,
              mainFontFallbacks: input.mainFontFallbacks,
              colorLinks: pdfConfig.colorLinks,
              linkColor: pdfConfig.linkColor,
              lang: input.lang,
              dir: input.dir,
            },
            format: input.format,
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

  private async generateDocument(
    document: PdfGenerationInput,
    format: DocumentFormat,
  ): Promise<{
    filename: string;
    unresolvedFields?: string[];
    renderedContentHash: string;
  }> {
    const strict = document.strict ?? false;

    if (
      Buffer.byteLength(document.content, "utf8") > pdfConfig.maxMarkdownBytes
    ) {
      throw new Error(
        `Document too large (max ${pdfConfig.maxMarkdownBytes} bytes)`,
      );
    }

    const unresolvedRequired =
      this.templatePlaceholderService.getUnresolvedRequiredFields(
        document.content,
        document.fieldValues,
      );
    if (unresolvedRequired.length > 0) {
      const report = unresolvedRequired
        .map((field) => {
          const suggestion = field.suggestedField
            ? `, field=${field.field}, suggestedField=${field.suggestedField}, distance=${field.distance}, code=${field.code}`
            : "";
          return `${field.name} (type=${field.type}, required=${field.required}, reason=${field.reason}${suggestion})`;
        })
        .join("; ");
      throw new Error(`Required template fields are unresolved: ${report}`);
    }

    const fieldValuesValidation =
      this.templatePlaceholderService.validateFieldValues(
        document.content,
        document.fieldValues,
      );
    if (!fieldValuesValidation.valid) {
      throw new Error(
        `Template field values validation failed: ${fieldValuesValidation.errors.join("; ")}`,
      );
    }

    const { result: interpolated, unresolved } =
      this.documentRenderingService.renderTemplate(
        document.content,
        document.fieldValues,
        strict,
      );
    const profile = this.resolveDocumentProfile(
      interpolated,
      document.language,
    );
    const renderedContentHash = sha256Signature(interpolated);

    await mkdir(this.getStoragePath(), { recursive: true });
    const filename = `${randomUUID()}.${format}`;
    const outputPath = join(this.getStoragePath(), filename);
    const args = this.buildPandocArgs({
      outputPath,
      format,
      lang: profile.lang,
      dir: profile.dir,
      mainFont: profile.mainFont,
      cjkMainFont: profile.cjkMainFont,
      mainFontFallbacks: profile.mainFontFallbacks,
    });

    if (this.resolvePdfMode() === "remote") {
      await this.runRemotePdfService({
        markdown: interpolated,
        outputPath,
        format,
        lang: profile.lang,
        dir: profile.dir,
        mainFont: profile.mainFont,
        cjkMainFont: profile.cjkMainFont,
        mainFontFallbacks: profile.mainFontFallbacks,
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

    throw lastError ?? new Error(`${format.toUpperCase()} generation error`);
  }

  async generatePdf(document: PdfGenerationInput): Promise<{
    filename: string;
    unresolvedFields?: string[];
    renderedContentHash: string;
  }> {
    return this.generateDocument(document, "pdf");
  }

  async generateDocx(document: PdfGenerationInput): Promise<{
    filename: string;
    unresolvedFields?: string[];
    renderedContentHash: string;
  }> {
    return this.generateDocument(document, "docx");
  }

  private resolveStorageFile(filename: string): string {
    const safe = basename(filename);
    if (!safe || safe === "." || safe === "..") {
      throw new Error(`Invalid filename: ${filename}`);
    }
    const filepath = resolve(this.getStoragePath(), safe);
    if (!filepath.startsWith(resolve(this.getStoragePath()))) {
      throw new Error(`Invalid filename: ${filename}`);
    }
    return filepath;
  }

  async getFileStream(filename: string): Promise<ReadStream> {
    const filepath = this.resolveStorageFile(filename);
    try {
      await access(filepath);
    } catch {
      throw new Error(`PDF file not found: ${filename}`);
    }
    return createReadStream(filepath);
  }

  async getPdfStream(filename: string): Promise<ReadStream> {
    return this.getFileStream(filename);
  }

  async deletePdf(filename: string): Promise<void> {
    const filepath = this.resolveStorageFile(filename);
    await unlink(filepath).catch(() => undefined);
  }
}
