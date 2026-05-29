import { Injectable, Logger } from "@nestjs/common";
import type { AiSemanticWarning } from "../../common/types/template-audit.type";
import type {
  AiProvider,
  AiTemplateAuditInput,
  AiTemplateAuditResult,
  AiTemplateDraftInput,
  AiTemplateDraftResult,
  TemplateSyntaxVariant,
} from "./ai-provider.interface";

interface OllamaGenerateResponse {
  response?: string;
}

interface ParsedOutput {
  warnings?: AiSemanticWarning[];
  model?: string;
}

interface TemplateDraftOutput {
  markdown?: string;
  model?: string;
}

@Injectable()
export class OllamaAiProvider implements AiProvider {
  readonly name = "ollama";
  private readonly logger = new Logger(OllamaAiProvider.name);

  private readonly baseUrl =
    process.env.OLLAMA_BASE_URL?.trim() || "http://localhost:11434";
  private readonly fallbackBaseUrl =
    process.env.OLLAMA_BASE_URL_FALLBACK?.trim() || "http://127.0.0.1:11434";
  private readonly requestTimeoutMs = this.parsePositiveInt(
    process.env.OLLAMA_REQUEST_TIMEOUT_MS,
    15000,
  );
  private readonly requestRetries = this.parsePositiveInt(
    process.env.OLLAMA_REQUEST_RETRIES,
    2,
  );
  private readonly retryBackoffMs = this.parsePositiveInt(
    process.env.OLLAMA_RETRY_BACKOFF_MS,
    1000,
  );

  private readonly model = process.env.OLLAMA_MODEL?.trim() || "qwen2.5:7b";
  private readonly compactPromptChars = this.parsePositiveInt(
    process.env.OLLAMA_COMPACT_PROMPT_CHARS,
    14000,
  );
  private readonly maxPromptChars = this.parsePositiveInt(
    process.env.OLLAMA_MAX_PROMPT_CHARS,
    20000,
  );
  private readonly draftMaxTokens = this.parsePositiveInt(
    process.env.OLLAMA_DRAFT_NUM_PREDICT,
    1200,
  );
  private readonly auditMaxTokens = this.parsePositiveInt(
    process.env.OLLAMA_AUDIT_NUM_PREDICT,
    250,
  );
  private readonly temperature = this.parseFloatInRange(
    process.env.OLLAMA_DRAFT_TEMPERATURE,
    0.2,
    0,
    1,
  );
  private readonly auditTemperature = this.parseFloatInRange(
    process.env.OLLAMA_AUDIT_TEMPERATURE,
    0,
    0,
    1,
  );
  private readonly keepAlive = process.env.OLLAMA_KEEP_ALIVE?.trim() || "10m";
  private readonly undiciDispatcher = this.buildUndiciDispatcher();

  constructor() {
    this.logger.log(
      `AI provider=ollama baseUrl=${this.baseUrl} model=${this.model} numPredict=${this.draftMaxTokens} temperature=${this.temperature}`,
    );
  }

  private buildUndiciDispatcher():
    | { close?: () => Promise<void> | void }
    | undefined {
    try {
      // Use undici Agent with relaxed headers/body timeouts so long-running
      // local model generations are governed by AbortController timeout only.
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { Agent } = require("undici") as {
        Agent?: new (
          opts?: Record<string, unknown>,
        ) => {
          close?: () => Promise<void> | void;
        };
      };
      if (!Agent) return undefined;
      return new Agent({
        headersTimeout: 0,
        bodyTimeout: 0,
      });
    } catch {
      return undefined;
    }
  }

  private resolveBaseUrls(): string[] {
    const unique = new Set<string>();
    const candidates = [this.baseUrl, this.fallbackBaseUrl]
      .map((value) => value.trim().replace(/\/$/, ""))
      .filter(Boolean);
    for (const candidate of candidates) unique.add(candidate);
    return [...unique];
  }

  private async fetchWithRetries(
    path: string,
    init: RequestInit,
  ): Promise<{ response: Response; baseUrl: string }> {
    const baseUrls = this.resolveBaseUrls();
    let lastError: unknown = null;
    for (const baseUrl of baseUrls) {
      for (let attempt = 1; attempt <= this.requestRetries; attempt++) {
        const attemptStarted = Date.now();
        const controller = new AbortController();
        const timeout = setTimeout(
          () => controller.abort(),
          this.requestTimeoutMs,
        );
        try {
          const response = await fetch(`${baseUrl}${path}`, {
            ...init,
            signal: controller.signal,
            ...(this.undiciDispatcher
              ? { dispatcher: this.undiciDispatcher }
              : {}),
          } as RequestInit);
          clearTimeout(timeout);
          const elapsedMs = Date.now() - attemptStarted;
          this.logger.log(
            `Ollama fetch success baseUrl=${baseUrl} attempt=${attempt}/${this.requestRetries} elapsedMs=${elapsedMs} timeoutMs=${this.requestTimeoutMs}`,
          );
          return { response, baseUrl };
        } catch (error) {
          clearTimeout(timeout);
          lastError = error;
          const elapsedMs = Date.now() - attemptStarted;
          const details =
            error instanceof Error
              ? JSON.stringify({
                  name: error.name,
                  message: error.message,
                  cause:
                    error.cause && typeof error.cause === "object"
                      ? {
                          ...(error.cause as Record<string, unknown>),
                        }
                      : error.cause,
                })
              : String(error);
          this.logger.warn(
            `Ollama fetch attempt failed baseUrl=${baseUrl} attempt=${attempt}/${this.requestRetries} elapsedMs=${elapsedMs} timeoutMs=${this.requestTimeoutMs} details=${details}`,
          );
          if (attempt < this.requestRetries) {
            const waitMs = Math.min(this.retryBackoffMs * attempt, 5000);
            await new Promise((resolve) => setTimeout(resolve, waitMs));
          }
        }
      }
    }
    throw this.buildConnectivityError(lastError);
  }

  private parsePositiveInt(
    value: string | undefined,
    fallback: number,
  ): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
    return Math.floor(parsed);
  }

  private parseFloatInRange(
    value: string | undefined,
    fallback: number,
    min: number,
    max: number,
  ): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    if (parsed < min || parsed > max) return fallback;
    return parsed;
  }

  private buildSyntaxGuide(variants: TemplateSyntaxVariant[]): string {
    return variants
      .map((variant) => `- ${variant.format} (esempio: ${variant.example})`)
      .join("\n");
  }

  private estimateTokens(value: string): number {
    const normalized = value.trim();
    if (!normalized) return 0;
    return Math.ceil(normalized.length / 4);
  }

  private parseMetadataFromDescription(description: string): {
    documentType: string;
    domain: string;
  } {
    const documentType =
      description.match(/document_type=([a-z_]+)/i)?.[1]?.trim() || "unknown";
    const domain =
      description.match(/domain=([a-z_]+)/i)?.[1]?.trim() || "unknown";
    return { documentType, domain };
  }

  private compactDescription(description: string): string {
    const markerPattern = /^\[[A-Z_]+\]$/m;
    const markerIndex = description.search(markerPattern);
    const userPrompt =
      markerIndex >= 0
        ? description.slice(0, markerIndex).trim()
        : description.trim();

    const extractBlock = (name: string): string[] => {
      const re = new RegExp(
        `\\[${name}\\]\\n([\\s\\S]*?)\\n\\[END_${name}\\]`,
        "i",
      );
      const match = description.match(re);
      if (!match) return [];
      return match[1]
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
    };

    const normalizeKv = (line: string): { key: string; value: string } => {
      const idx = line.indexOf("=");
      if (idx < 0) return { key: line.toLowerCase(), value: "" };
      return {
        key: line.slice(0, idx).trim().toLowerCase(),
        value: line.slice(idx + 1).trim(),
      };
    };

    const backendLines = extractBlock("BACKEND_INTENT_NORMALIZATION");
    const documentType =
      backendLines
        .map(normalizeKv)
        .find((entry) => entry.key === "document_type")?.value || "unknown";
    const domain =
      backendLines.map(normalizeKv).find((entry) => entry.key === "domain")
        ?.value || "unknown";

    const commonRules = [
      "output_only_markdown=true",
      "valid_placeholders_required=true",
      "no_malformed_placeholders=true",
      "no_unsupported_placeholder_types=true",
      "coherence_with_user_request=true",
      "avoid_profile_contamination=true",
    ];

    const documentBlock = extractBlock("DOCUMENT_TYPE_PROFILE")
      .map(normalizeKv)
      .filter((entry) =>
        [
          "profile_active",
          "suggested_sections",
          "suggested_fields",
          "required_sections_by_type",
          "recommended_table_sections",
          "content_directives",
          "anti_patterns",
          "table_schemas",
          "reference_standard",
        ].includes(entry.key),
      )
      .filter(
        (entry) =>
          entry.key !== "profile_active" ||
          entry.value.toLowerCase() === documentType.toLowerCase(),
      )
      .map((entry) => {
        if (entry.key === "content_directives") {
          const compactBullets = entry.value
            .split("|")
            .map((part) => part.trim())
            .filter(Boolean)
            .map((part) => `- ${part.replace(/\s+/g, " ")}`)
            .join(" ");
          return `${entry.key}=${compactBullets || "none"}`;
        }
        if (entry.key === "table_schemas") {
          const normalizedSchemas = entry.value
            .split("|")
            .map((schema) => schema.trim())
            .filter(Boolean)
            .map((schema) => schema.replace(/\s+/g, " "));
          return `${entry.key}=${normalizedSchemas.join(" | ") || "none"}`;
        }
        return `${entry.key}=${entry.value}`;
      });

    const domainBlock = extractBlock("DOMAIN_PROFILE")
      .map(normalizeKv)
      .filter((entry) =>
        ["profile_active", "semantic_rules", "recommended_terms"].includes(
          entry.key,
        ),
      )
      .filter(
        (entry) =>
          entry.key !== "profile_active" ||
          entry.value.toLowerCase() === domain.toLowerCase(),
      )
      .map((entry) => `${entry.key}=${entry.value}`);

    const userRequirements = extractBlock("USER_EXPLICIT_REQUIREMENTS");
    const outputConstraints = extractBlock("OUTPUT_CONSTRAINTS");

    const rebuilt = [
      userPrompt,
      "",
      "[BACKEND_INTENT_NORMALIZATION]",
      `document_type=${documentType}`,
      `domain=${domain}`,
      "[END_BACKEND_INTENT_NORMALIZATION]",
      "[COMMON_PROMPT_RULES]",
      ...commonRules,
      "[END_COMMON_PROMPT_RULES]",
      "[DOCUMENT_TYPE_PROFILE]",
      ...documentBlock,
      "[END_DOCUMENT_TYPE_PROFILE]",
      "[DOMAIN_PROFILE]",
      ...domainBlock,
      "[END_DOMAIN_PROFILE]",
      "[USER_EXPLICIT_REQUIREMENTS]",
      ...userRequirements,
      "[END_USER_EXPLICIT_REQUIREMENTS]",
      "[OUTPUT_CONSTRAINTS]",
      ...outputConstraints,
      "[END_OUTPUT_CONSTRAINTS]",
    ]
      .filter((line) => line !== "")
      .join("\n");

    return rebuilt;
  }

  private buildTemplateDraftPromptWithBudget(input: AiTemplateDraftInput): {
    prompt: string;
    compactMode: boolean;
  } {
    const prompt = this.buildTemplateDraftPrompt(input, false);
    if (prompt.length <= this.compactPromptChars) {
      return { prompt, compactMode: false };
    }
    const compactPrompt = this.buildTemplateDraftPrompt(
      { ...input, description: this.compactDescription(input.description) },
      true,
    );
    return { prompt: compactPrompt, compactMode: true };
  }

  private buildTemplateDraftPrompt(
    input: AiTemplateDraftInput,
    compactMode: boolean,
  ): string {
    const allowTechnical =
      input.outputConstraints?.allowTechnicalPlaceholders ?? true;
    const requireTechnical =
      input.outputConstraints?.requireTechnicalPlaceholders ?? false;
    const grammar = this.buildSyntaxGuide(input.syntaxProfile.variants);
    const validExamples = (
      input.syntaxSpec?.canonicalExamples?.length
        ? input.syntaxSpec.canonicalExamples
        : input.syntaxProfile.variants.map((variant) => variant.example)
    ).slice(0, compactMode ? 3 : 8);
    const invalidExamples = compactMode
      ? ["{{string:nome cliente}}"]
      : [
          "{{string:nome cliente}}",
          "{{string:unità_responsabile}}",
          "{{string:nome_cliente:length:true}}",
          "{{list:stato_cliente:length:true:Stato,Sospeso}}",
        ];
    const generationMode = input.generationMode ?? "guided";
    const listSupported = input.syntaxProfile.supportedTypes.includes("list");
    const officialSyntaxSpec = input.syntaxSpec?.compactGrammar?.trim() || null;
    return [
      "[SYSTEM]",
      "Sei un generatore di template Markdown per parser deterministico.",
      "Restituisci esclusivamente il template Markdown finale.",
      "",
      "[USER_PROMPT]",
      input.description.trim(),
      "",
      "[BACKEND_RULE]",
      "Se nel prompt trovi blocchi BACKEND_INTENT_NORMALIZATION, COMMON_PROMPT_RULES, DOCUMENT_TYPE_PROFILE, DOMAIN_PROFILE, USER_EXPLICIT_REQUIREMENTS, OUTPUT_CONSTRAINTS o OFFICIAL_PLACEHOLDER_SYNTAX, trattali come requisiti vincolanti.",
      "Le regole specifiche di profilo valgono solo se presenti nei blocchi di profilo.",
      "Non applicare standard/sezioni di altri tipi documento quando non richiesti dal profilo attivo.",
      officialSyntaxSpec
        ? "La sezione OFFICIAL_PLACEHOLDER_SYNTAX e autoritativa: non inventare sintassi fuori da quelle regole."
        : "Se manca OFFICIAL_PLACEHOLDER_SYNTAX, usa comunque solo varianti indicate in sintassi e tipi supportati.",
      "",
      ...(officialSyntaxSpec
        ? ["[OFFICIAL_PLACEHOLDER_SYNTAX]", officialSyntaxSpec, ""]
        : []),
      "[OUTPUT_CONSTRAINTS]",
      `Lingua: ${input.language?.trim() || "it"}`,
      "Non generare JSON.",
      "Non aggiungere spiegazioni fuori template.",
      "Produci un template Markdown completo e concluso: non interrompere frasi, tabelle, sezioni o placeholder.",
      "I campi compilabili devono stare direttamente sotto la spiegazione della sezione.",
      "NON inserire placeholder nei titoli Markdown (#, ##, ###, ...).",
      "NON usare lo stesso field_name in due sezioni diverse: se serve, usa nomi distinti.",
      "Nelle tabelle Markdown usa placeholder di tipo string nelle celle; evita text nelle celle.",
      "field_name deve rispettare snake_case:",
      input.syntaxProfile.fieldNamePattern,
      "Tipi ammessi:",
      input.syntaxProfile.supportedTypes.join(", "),
      `Prompt mode: ${generationMode}`,
      allowTechnical
        ? "Placeholder tecnici consentiti."
        : "Placeholder tecnici vietati: non usare sintassi {{type:field_name}}.",
      requireTechnical
        ? "Placeholder tecnici obbligatori. Usa solo grammatica ammessa."
        : "Non rendere obbligatorio l'uso di placeholder tecnici.",
      "Se usi placeholder tecnici, usa solo:",
      grammar,
      "Usa SEMPRE placeholder in forma canonica estesa: {{tipo:nome:maxLength:required}} (eccetto list che usa il formato ufficiale list).",
      "Esempi validi:",
      validExamples.map((e) => `- ${e}`).join("\n"),
      "Esempi NON validi:",
      invalidExamples.map((e) => `- ${e}`).join("\n"),
      "required deve essere true o false.",
      "length deve essere intero positivo. Non usare mai la parola letterale 'length' o 'maxLength' al posto del numero nei placeholder.",
      listSupported
        ? "Sintassi list valida: {{list:nome:80:true:nome_lista,Opzione1,Opzione2,Opzione3}}. Il terzo parametro (lunghezza/limite) deve essere sempre un numero intero positivo."
        : "Tipo list non supportato in questa generazione: non usare placeholder list.",
      ...(compactMode
        ? [
            "Per list: field_name snake_case, length numerico, required true/false, ultimo parametro CSV label,opzione1,opzione2.",
            "Non generare placeholder vuoti come {{}}.",
            "I titoli devono essere testo statico, non compilabile.",
            "Non aggiungere note finali o testo fuori template.",
          ]
        : [
            listSupported
              ? "Per list: field_name snake_case, length numerico, required true/false, ultimo parametro CSV con label descrittiva e almeno una opzione."
              : "Sostituisci liste/opzioni con {{text:...}} o campi espliciti {{string:campo_1}}, {{string:campo_2}}.",
            "Evita list se non strettamente necessario: preferisci {{text:...}} o {{string:...}}.",
            listSupported
              ? "Se non hai opzioni predefinite certe, NON usare list."
              : "Non generare esempi con list:length o parametri list.",
            "Non aggiungere label o valori CSV a tipi diversi da list.",
            "Per tipi non-list usa solo {{type:field_name}}, {{type:field_name:length}} o {{type:field_name:length:true|false}}.",
            "Lo stesso field_name deve mantenere SEMPRE lo stesso tipo in tutto il template.",
            "Se servono versione breve e lunga, usa field_name diversi (es: sintesi_progetto string e descrizione_progetto text).",
            "Non generare placeholder vuoti come {{}}.",
            "NON valido: {{list:obiettivi:length:true:Obiettivi}} (length non numerico e opzioni mancanti).",
            "NON valido: {{list:rischi:80:true:rischi}} (opzioni mancanti dopo la label).",
            "NON valido: {{string:nome_cliente:100:true:stati_cliente:Attivo,Sospeso}} (parametri list su tipo string).",
            "Usa list solo per scelta tra opzioni predefinite (es: priorita Alta/Media/Bassa, stato Approvato/In revisione/Respinto, livello rischio Alto/Medio/Basso).",
            "Se la sezione Rischi iniziali e gia in tabella, non aggiungere campi list come rischi_aggiuntivi.",
            "Per campi descrittivi/aperti usa text (es: obiettivi_progetto, benefici_attesi, descrizione_progetto, business_case, ambito_preliminare, vincoli, assunzioni).",
            "Obiettivi del progetto e Benefici attesi devono essere text salvo richiesta esplicita di opzioni predefinite.",
            "I titoli devono essere testo statico, non compilabile.",
            "Per ogni sezione: titolo statico + spiegazione descrittiva reale in italiano + campi compilabili sotto la spiegazione.",
            "Non duplicare inutilmente lo stesso placeholder nella stessa sezione o in sezioni diverse.",
            "Nessuna sezione/sottosezione chiamata 'Campi compilabili', 'Tavola' o 'Input'.",
            "Non aggiungere note finali o testo fuori template (es. 'Questo template e progettato...','Ricorda di...').",
            "Evita frasi segnaposto generiche; rendi le descrizioni utili alla compilazione.",
          ]),
      "Usa sezioni e tabelle coerenti con documentType/domain richiesti.",
      "Output solo markdown completo (titolo + almeno una sezione + placeholder).",
    ].join("\n");
  }

  private buildPrompt(input: AiTemplateAuditInput): string {
    const compactFields = input.fields.map((field) => ({
      fieldName: field.fieldName,
      currentType: field.currentType,
      surroundingText: field.surroundingText,
      fullLine: field.fullLine,
      allowedTypes: field.allowedTypes,
    }));
    return [
      "Sei un auditor semantico di template markdown tipizzati.",
      "Rispondi SOLO con JSON compatto valido.",
      "Genera warning SOLO se esiste una reale incoerenza semantica tra surroundingText/fullLine, fieldName e currentType.",
      "Non segnalare campi plausibili come string: nome, cliente, referente, ragione sociale, descrizione, oggetto, numero contratto.",
      "Non segnalare se currentType e gia coerente (es. currency/importo, date/data, boolean/attivo).",
      "Non segnalare solo perche un campo potrebbe usare anche un altro tipo.",
      "In caso di dubbio, NON segnalare.",
      "Controlli semantici prioritari (solo se mismatch reale):",
      "- label o nome con 'data'/'scadenza'/'stipula' -> date",
      "- label o nome con 'importo'/'totale'/'prezzo'/'costo' -> currency",
      "- label o nome con 'durata'/'mesi'/'quantita'/'numero' -> integer",
      "- label o nome con 'email' -> email",
      "- label o nome con 'telefono'/'phone' -> phone",
      "Se currentType e gia uno di questi tipi coerenti, NON creare warning.",
      "NON correggere sintassi placeholder e NON correggere refusi tipo strig->string.",
      "NON generare template e NON applicare modifiche automatiche.",
      "suggestedType deve essere SEMPRE null oppure uno dei valori presenti in allowedTypes.",
      "Se non c'e mismatch non includere il campo in warnings.",
      "Massimo 1 warning per campo.",
      "Schema output:",
      '{"warnings":[{"fieldName":"string","currentType":"string","suggestedType":"string|null","reason":"string","confidence":0.0,"severity":"info|warning"}],"model":"string"}',
      "Tipi consentiti globali (usali per suggestedType):",
      JSON.stringify(input.allowedTypes),
      "Campi con contesto:",
      JSON.stringify(compactFields),
      "Estratto template (solo riferimento):",
      input.markdown.slice(0, 1200),
    ].join("\n");
  }

  getRuntimeConfig(): {
    provider: "ollama";
    baseUrl: string;
    model: string;
    numPredict: number;
    temperature: number;
    keepAlive: string;
  } {
    return {
      provider: "ollama",
      baseUrl: this.baseUrl,
      model: this.model,
      numPredict: this.draftMaxTokens,
      temperature: this.temperature,
      keepAlive: this.keepAlive,
    };
  }

  async healthCheck(): Promise<{
    ok: boolean;
    baseUrl: string;
    model: string;
    error?: string;
  }> {
    try {
      const { response, baseUrl } = await this.fetchWithRetries("/api/tags", {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) {
        return {
          ok: false,
          baseUrl,
          model: this.model,
          error: `Ollama health check failed with status ${response.status}`,
        };
      }
      return { ok: true, baseUrl, model: this.model };
    } catch (error) {
      const reason =
        error instanceof Error ? error.message : String(error ?? "unknown");
      return {
        ok: false,
        baseUrl: this.baseUrl,
        model: this.model,
        error: `Unable to reach Ollama at ${this.baseUrl}: ${reason}`,
      };
    }
  }

  private buildConnectivityError(error: unknown): Error {
    const reason =
      error instanceof Error ? error.message : String(error ?? "unknown");
    const isTimeout =
      (error instanceof Error &&
        (error.name === "AbortError" ||
          reason.toLowerCase().includes("aborted"))) ||
      reason.toLowerCase().includes("timeout");
    if (isTimeout) {
      return new Error(
        [
          "Ollama request timed out.",
          `baseUrl=${this.baseUrl}`,
          `model=${this.model}`,
          `timeoutMs=${this.requestTimeoutMs}`,
          "Generation may be too slow for current num_predict/model; increase timeout or reduce num_predict.",
        ].join(" "),
      );
    }
    return new Error(
      [
        "Unable to contact Ollama.",
        `baseUrl=${this.baseUrl}`,
        `model=${this.model}`,
        `reason=${reason}`,
        "Check that Ollama is running and environment variables are correctly configured.",
      ].join(" "),
    );
  }

  private sanitizeWarnings(raw: unknown): AiSemanticWarning[] {
    if (!Array.isArray(raw)) return [];
    return raw
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const entry = item as Record<string, unknown>;
        const fieldName = String(entry.fieldName ?? "").trim();
        const currentType = String(entry.currentType ?? "").trim();
        const suggestedTypeRaw = entry.suggestedType;
        const suggestedType =
          suggestedTypeRaw === null || suggestedTypeRaw === undefined
            ? null
            : String(suggestedTypeRaw).trim() || null;
        const reason = String(entry.reason ?? "").trim();
        const confidence = Number(entry.confidence ?? 0);
        const severity = entry.severity === "info" ? "info" : "warning";
        if (!fieldName || !currentType || !reason) return null;
        return {
          fieldName,
          currentType,
          suggestedType,
          reason,
          confidence: Number.isFinite(confidence)
            ? Math.max(0, Math.min(1, confidence))
            : 0,
          severity,
        } as AiSemanticWarning;
      })
      .filter((item): item is AiSemanticWarning => item !== null);
  }

  private async readOllamaStreamingResponse(
    response: Response,
  ): Promise<string> {
    const body = response.body;
    if (!body) {
      const payload = (await response.json()) as OllamaGenerateResponse;
      return payload.response?.trim() ?? "";
    }

    const decoder = new TextDecoder();
    let buffer = "";
    let fullText = "";

    const parseLine = (line: string): void => {
      const trimmed = line.trim();
      if (!trimmed) return;
      let chunk: Record<string, unknown>;
      try {
        chunk = JSON.parse(trimmed) as Record<string, unknown>;
      } catch {
        return;
      }
      const responsePart =
        typeof chunk.response === "string" ? chunk.response : "";
      if (responsePart) fullText += responsePart;
    };

    for await (const chunk of body as unknown as AsyncIterable<Uint8Array>) {
      buffer += decoder.decode(chunk, { stream: true });
      let newlineIndex = buffer.indexOf("\n");
      while (newlineIndex >= 0) {
        const line = buffer.slice(0, newlineIndex);
        buffer = buffer.slice(newlineIndex + 1);
        parseLine(line);
        newlineIndex = buffer.indexOf("\n");
      }
    }

    buffer += decoder.decode();
    if (buffer.trim()) parseLine(buffer);
    return fullText.trim();
  }

  async analyzeTemplate(
    input: AiTemplateAuditInput,
  ): Promise<AiTemplateAuditResult> {
    const started = Date.now();
    const { response } = await this.fetchWithRetries("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        prompt: this.buildPrompt(input),
        stream: true,
        options: {
          temperature: this.auditTemperature,
          num_predict: this.auditMaxTokens,
        },
        keep_alive: this.keepAlive,
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama request failed: ${response.status}`);
    }

    const rawText = await this.readOllamaStreamingResponse(response);
    if (!rawText) {
      throw new Error("Ollama returned empty response");
    }

    let parsed: ParsedOutput;
    try {
      parsed = JSON.parse(rawText) as ParsedOutput;
    } catch {
      const match = rawText.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("Ollama returned invalid JSON");
      parsed = JSON.parse(match[0]) as ParsedOutput;
    }

    return {
      warnings: this.sanitizeWarnings(parsed.warnings),
      model:
        parsed.model?.trim() && parsed.model.trim().toLowerCase() !== "string"
          ? parsed.model.trim()
          : this.model,
      latencyMs: Date.now() - started,
    };
  }

  async generateTemplateDraft(
    input: AiTemplateDraftInput,
  ): Promise<AiTemplateDraftResult> {
    const started = Date.now();
    const { prompt, compactMode } =
      this.buildTemplateDraftPromptWithBudget(input);
    const tokenEstimate = this.estimateTokens(prompt);
    const metadata = this.parseMetadataFromDescription(input.description);
    this.logger.log(
      `Ollama draft prompt provider=${this.name} model=${this.model} documentType=${metadata.documentType} domain=${metadata.domain} num_predict=${this.draftMaxTokens} prompt_chars=${prompt.length} prompt_tokens_est=${tokenEstimate} compactMode=${compactMode}`,
    );
    if (prompt.length > this.maxPromptChars) {
      this.logger.warn(
        `Ollama prompt budget exceeded provider=${this.name} model=${this.model} documentType=${metadata.documentType} domain=${metadata.domain} compactMode=${compactMode} prompt_chars=${prompt.length} max_chars=${this.maxPromptChars} prompt_tokens_est=${tokenEstimate}`,
      );
      throw new Error(
        `Prompt budget exceeded after safe compaction: prompt_chars=${prompt.length} max_chars=${this.maxPromptChars}`,
      );
    }
    const { response } = await this.fetchWithRetries("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        prompt,
        stream: true,
        options: {
          temperature: this.temperature,
          num_predict: this.draftMaxTokens,
        },
        keep_alive: this.keepAlive,
      }),
    });
    if (!response.ok) {
      throw new Error(`Ollama request failed: ${response.status}`);
    }

    const rawText = await this.readOllamaStreamingResponse(response);
    if (!rawText) {
      throw new Error("Ollama returned empty response");
    }

    let markdown = rawText;
    const fenced =
      rawText.match(/```(?:markdown|md)?\s*([\s\S]*?)```/i)?.[1]?.trim() ?? "";
    if (fenced) markdown = fenced;

    const parsedJson = rawText.match(/\{[\s\S]*\}/)?.[0];
    if (parsedJson) {
      try {
        const parsed = JSON.parse(parsedJson) as TemplateDraftOutput;
        if (typeof parsed.markdown === "string" && parsed.markdown.trim()) {
          markdown = parsed.markdown.trim();
        }
      } catch {
        // Keep raw markdown fallback.
      }
    }

    return {
      markdown,
      model: this.model,
      latencyMs: Date.now() - started,
      options: {
        numPredict: this.draftMaxTokens,
        temperature: this.temperature,
      },
    };
  }
}
