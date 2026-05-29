import { Inject, Injectable, Logger } from "@nestjs/common";
import type { TemplateDraftGenerationResult } from "../common/types/template-draft.type";
import {
  normalizeFieldName,
  titleFromFieldName,
} from "../common/utils/field-name.utils";
import type { TemplateSyntaxSpec } from "./ai/ai-provider.interface";
import { MockAiProvider } from "./ai/mock-ai.provider";
import { OllamaAiProvider } from "./ai/ollama-ai.provider";
import { buildTemplatePromptDescription } from "./prompt/template-prompt.builder";
import { TemplateAuditService } from "./template-audit.service";
import {
  type InferredGenerationIntent,
  TemplateIntentClassifier,
} from "./template-intent.classifier";
import { TemplatePlaceholderService } from "./template-placeholder.service";
import {
  AUDIT_DOCUMENT_REQUIRED_PROFILES,
  DOCUMENT_BLUEPRINTS,
  type SupportedDocumentType,
} from "./template-profiles/document-type.profiles";
import { DOMAIN_PROFILES } from "./template-profiles/domain.profiles";

export interface GenerateTemplateDraftInput {
  description: string;
  language?: string;
  runSemanticAudit?: boolean;
  generationMode?: "free" | "guided";
  autoRepair?: boolean;
  defaultLength?: number;
}
export interface RepairTemplateDraftInput {
  content: string;
  language?: string;
  runSemanticAudit?: boolean;
  generationMode?: "free" | "guided";
  defaultLength?: number;
}

interface DidacticSectionAssessment {
  hasPlaceholder: boolean;
  hasDescription: boolean;
  genericDescription: boolean;
}

interface DidacticQualityAssessment {
  score: number;
  sectionsWithDescription: number;
  sectionsMissingDescription: number;
  genericDescriptionsCount: number;
  issues: string[];
}

@Injectable()
export class TemplateDraftGenerationService {
  private readonly logger = new Logger(TemplateDraftGenerationService.name);
  private readonly maxGenerationRetries = Math.max(
    0,
    Number.parseInt(process.env.TEMPLATE_DRAFT_MAX_RETRIES ?? "1", 10) || 1,
  );
  private readonly defaultRepairLength = Number.parseInt(
    process.env.TEMPLATE_DRAFT_DEFAULT_LENGTH ?? "100",
    10,
  );
  private readonly defaultListValues = (
    process.env.TEMPLATE_DRAFT_DEFAULT_LIST_VALUES?.trim() ||
    "Opzione1,Opzione2,Opzione3"
  )
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .join(",");
  private readonly documentBlueprints = DOCUMENT_BLUEPRINTS;
  private readonly domainProfiles = DOMAIN_PROFILES;
  private readonly intentClassifier = new TemplateIntentClassifier();

  constructor(
    @Inject(TemplatePlaceholderService)
    private readonly placeholderService: TemplatePlaceholderService,
    @Inject(TemplateAuditService)
    private readonly templateAuditService: TemplateAuditService,
    @Inject(MockAiProvider)
    private readonly mockAiProvider: MockAiProvider,
    @Inject(OllamaAiProvider)
    private readonly ollamaAiProvider: OllamaAiProvider,
  ) {
    const provider = (process.env.AI_PROVIDER?.trim().toLowerCase() ||
      "mock") as "mock" | "ollama";
    this.logger.log(
      `AI startup config provider=${provider} baseUrl=${process.env.OLLAMA_BASE_URL ?? "-"} model=${process.env.OLLAMA_MODEL ?? "-"} numPredict=${process.env.OLLAMA_DRAFT_NUM_PREDICT ?? "-"} temperature=${process.env.OLLAMA_DRAFT_TEMPERATURE ?? "-"}`,
    );
  }

  private resolveProvider(): MockAiProvider | OllamaAiProvider {
    const requested = (process.env.AI_PROVIDER?.trim().toLowerCase() ||
      "mock") as "mock" | "ollama";
    if (requested === "ollama") return this.ollamaAiProvider;
    return this.mockAiProvider;
  }

  private sanitizeGeneratedMarkdown(raw: string): string {
    const trimmed = raw.trim();
    if (!trimmed) return "";

    const fenced =
      trimmed.match(/```(?:markdown|md)?\s*([\s\S]*?)```/i)?.[1]?.trim() ?? "";
    const candidate = fenced || trimmed;
    const lines = candidate.split(/\r?\n/);
    if (lines.length === 0) return candidate;

    const firstMarkdownLineIndex = lines.findIndex((line) => {
      const text = line.trim();
      if (!text) return false;
      return (
        text.startsWith("#") ||
        text.startsWith("|") ||
        text.startsWith("- ") ||
        text.startsWith("* ") ||
        text.startsWith(">") ||
        /^\d+\.\s+/.test(text) ||
        text.includes("{{")
      );
    });
    if (firstMarkdownLineIndex <= 0) {
      return candidate.trim();
    }
    return lines.slice(firstMarkdownLineIndex).join("\n").trim();
  }

  private getGenerationSyntaxProfile() {
    return this.placeholderService.describeTemplateSyntaxProfile();
  }

  private getGenerationSyntaxSpec(): TemplateSyntaxSpec | null {
    return this.placeholderService.buildTemplateSyntaxSpec();
  }

  private ensureCompleteProjectCharter(markdown: string): string {
    const required: CharterSectionBlueprint[] = [
      {
        title: "Titolo e informazioni generali del progetto",
        aliases: ["informazioni generali progetto"],
        lines: [
          "## Titolo e informazioni generali del progetto",
          "Questa sezione raccoglie gli identificativi principali del progetto e i riferimenti necessari per l'avvio formale. I dati permettono a sponsor, project manager e stakeholder di riconoscere in modo univoco il Project Charter.",
          "Nome progetto: {{string:nome_progetto}}",
          "Data inizio: {{date:data_inizio}}",
          "Data fine: {{date:data_fine}}",
        ],
      },
      {
        title: "Descrizione del progetto",
        lines: [
          "## Descrizione del progetto",
          "Descrivere il contesto, il problema o l'opportunità e il risultato generale atteso. La descrizione deve chiarire perché il progetto viene avviato e come contribuirà alla creazione di valore.",
          "Sintesi progetto: {{string:sintesi_progetto}}",
          "Descrizione progetto: {{text:descrizione_progetto}}",
        ],
      },
      {
        title: "Business case o motivazione del progetto",
        lines: [
          "## Business case o motivazione del progetto",
          "Spiegare la motivazione organizzativa, il valore atteso e le ragioni che giustificano l'investimento. La sezione deve collegare il progetto agli obiettivi strategici e ai benefici misurabili.",
          "Business case: {{text:business_case}}",
        ],
      },
      {
        title: "Obiettivi del progetto",
        lines: [
          "## Obiettivi del progetto",
          "Definire obiettivi chiari, misurabili e coerenti con il business case. Gli obiettivi guidano la pianificazione e permettono di valutare l'avanzamento progetto.",
          "| Obiettivo | Descrizione | Metrica | Target |",
          "|---|---|---|---|",
          "| {{string:obiettivo_1}} | {{string:descrizione_obiettivo_1}} | {{string:metrica_obiettivo_1}} | {{string:target_obiettivo_1}} |",
        ],
      },
      {
        title: "Benefici attesi",
        lines: [
          "## Benefici attesi",
          "Descrivere i benefici attesi per l'organizzazione e per gli stakeholder principali. La sezione aiuta a collegare deliverable, risultati e creazione di valore.",
          "| Beneficio | Indicatore | Valore atteso |",
          "|---|---|---|",
          "| {{string:beneficio_1}} | {{string:indicatore_beneficio_1}} | {{string:valore_atteso_beneficio_1}} |",
        ],
      },
      {
        title: "Ambito preliminare del progetto",
        lines: [
          "## Ambito preliminare del progetto",
          "Descrivere il perimetro iniziale del progetto, includendo confini, principali inclusioni ed esclusioni. L'ambito preliminare riduce ambiguità e supporta le decisioni di pianificazione.",
          "| Incluso | Escluso | Note |",
          "|---|---|---|",
          "| {{string:ambito_incluso_1}} | {{string:ambito_escluso_1}} | {{string:note_ambito_1}} |",
        ],
      },
      {
        title: "Deliverable principali",
        lines: [
          "## Deliverable principali",
          "Elencare i principali risultati attesi e il criterio con cui saranno accettati. La tabella rende tracciabile il collegamento tra ambito preliminare, responsabilita e approvazione formale.",
          "| Deliverable | Descrizione | Criterio di accettazione |",
          "|---|---|---|",
          "| {{string:deliverable_1}} | {{string:descrizione_deliverable_1}} | {{string:criterio_accettazione_deliverable_1}} |",
        ],
      },
      {
        title: "Milestone principali",
        lines: [
          "## Milestone principali",
          "Indicare le tappe principali usate per monitorare l'avanzamento progetto e prendere decisioni di controllo. Ogni milestone deve rappresentare un punto verificabile del percorso.",
          "| Milestone | Data prevista | Risultato atteso |",
          "|---|---|---|",
          "| {{string:milestone_1}} | {{date:data_milestone_1}} | {{string:risultato_milestone_1}} |",
        ],
      },
      {
        title: "Stakeholder principali",
        lines: [
          "## Stakeholder principali",
          "Identificare gli stakeholder principali, il loro ruolo e l'interesse rispetto al progetto. Questa informazione supporta comunicazione, coinvolgimento e gestione delle aspettative.",
          "| Stakeholder | Ruolo | Interesse |",
          "|---|---|---|",
          "| {{string:stakeholder_1}} | {{string:ruolo_stakeholder_1}} | {{string:interesse_stakeholder_1}} |",
        ],
      },
      {
        title: "Ruoli e responsabilita iniziali",
        lines: [
          "## Ruoli e responsabilita iniziali",
          "Definire ruoli e responsabilita iniziali per chiarire chi decide, chi esegue e chi approva. La tabella rende esplicito il modello operativo nella fase di avvio.",
          "| Ruolo | Responsabilita | Referente |",
          "|---|---|---|",
          "| {{string:ruolo_1}} | {{string:responsabilita_ruolo_1}} | {{string:referente_ruolo_1}} |",
        ],
      },
      {
        title: "Requisiti di alto livello",
        lines: [
          "## Requisiti di alto livello",
          "Raccogliere i requisiti di alto livello che indirizzano analisi, soluzione e pianificazione. La tabella permette di distinguere priorita e contenuto dei requisiti prima del dettaglio tecnico.",
          "| Requisito | Descrizione | Priorita |",
          "|---|---|---|",
          "| {{string:requisito_1}} | {{string:descrizione_requisito_1}} | {{string:priorita_requisito_1}} |",
        ],
      },
      {
        title: "Assunzioni",
        lines: [
          "## Assunzioni",
          "Documentare le ipotesi considerate vere al momento dell'approvazione iniziale. Le assunzioni devono essere verificabili e utili a interpretare pianificazione, rischi e vincoli.",
          "Assunzioni principali: {{text:assunzioni_principali}}",
        ],
      },
      {
        title: "Vincoli",
        lines: [
          "## Vincoli",
          "Documentare limiti temporali, economici, tecnici, organizzativi o normativi che condizionano il progetto. I vincoli aiutano a definire scelte realistiche e responsabilita decisionali.",
          "Vincoli principali: {{text:vincoli_principali}}",
        ],
      },
      {
        title: "Rischi iniziali",
        aliases: ["rischi principali", "rischi"],
        lines: [
          "## Rischi iniziali",
          "Identificare i principali rischi noti nella fase di avvio e le prime azioni di mitigazione. La tabella supporta una lettura rapida di probabilità, impatto e risposta iniziale.",
          "| Rischio | Descrizione | Probabilità | Impatto | Mitigazione |",
          "|---|---|---|---|---|",
          "| {{string:rischio_1}} | {{string:descrizione_rischio_1}} | {{percentage:probabilita_rischio_1}} | {{string:impatto_rischio_1}} | {{string:mitigazione_rischio_1}} |",
        ],
      },
      {
        title: "Budget preliminare",
        aliases: ["budget", "budget stimato"],
        lines: [
          "## Budget preliminare",
          "Documentare la stima economica iniziale e le fonti di finanziamento note. Il budget preliminare non sostituisce il piano dei costi, ma fornisce un riferimento per l'approvazione formale.",
          "| Voce di costo | Importo stimato | Note |",
          "|---|---|---|",
          "| {{string:voce_costo_1}} | {{currency:importo_stimato_1}} | {{string:note_budget_1}} |",
        ],
      },
      {
        title: "Criteri di successo",
        lines: [
          "## Criteri di successo",
          "Definire criteri misurabili per valutare se il progetto ha raggiunto gli esiti attesi. I criteri devono essere comprensibili per sponsor, project manager e stakeholder.",
          "Criteri di successo: {{text:criteri_successo}}",
        ],
      },
      {
        title: "Autorita del Project Manager",
        lines: [
          "## Autorita del Project Manager",
          "Descrivere poteri decisionali, limiti di autonomia e responsabilità assegnate al Project Manager. La sezione chiarisce quali decisioni possono essere prese senza ulteriori escalation.",
          "| Ambito decisionale | Limite/autonomia | Note |",
          "|---|---|---|",
          "| {{string:ambito_decisionale_pm_1}} | {{string:limite_autonomia_pm_1}} | {{string:note_autorita_pm_1}} |",
        ],
      },
      {
        title: "Approvazioni finali",
        lines: [
          "## Approvazioni finali",
          "Raccogliere le approvazioni formali necessarie per autorizzare il Project Charter. La tabella documenta chi approva, con quale ruolo e in quale data.",
          "| Nome | Ruolo | Data approvazione | Firma/Conferma |",
          "|---|---|---|---|",
          "| {{string:nome_approvatore_1}} | {{string:ruolo_approvatore_1}} | {{date:data_approvazione_1}} | {{string:firma_conferma_1}} |",
        ],
      },
    ];

    const cleaned = this.removeRepeatedGenericSectionHeadings(markdown);
    const withoutRedundantDescriptiveHeadings =
      this.removeRedundantDescriptiveSubsections(cleaned);
    const tableHardened = this.normalizeTablePlaceholders(
      withoutRedundantDescriptiveHeadings,
    );
    const consistentTypes = this.enforceConsistentFieldTypes(tableHardened);
    const canonicalPlaceholders =
      this.enforceExtendedCanonicalPlaceholders(consistentTypes);

    const lines = canonicalPlaceholders.split(/\r?\n/);
    const headings = lines
      .map((line, index) => ({ line, index }))
      .filter(({ line }) => /^##\s+/.test(line.trim()));
    const sections = headings.map((heading, index) => {
      const end =
        index + 1 < headings.length ? headings[index + 1].index : lines.length;
      return {
        title: heading.line.replace(/^##\s+/, "").trim(),
        lines: lines.slice(heading.index, end),
      };
    });
    const h1 =
      lines.find((line) => /^#\s+/.test(line.trim())) ?? "# Project Charter";
    const normalizedH1Title = h1.replace(/^#\s+/, "").trim().toLowerCase();
    const orderedSections: string[] = [h1.trim()];

    for (const blueprint of required) {
      const match = sections.find((section) => {
        const title = section.title.toLowerCase();
        if (title === blueprint.title.toLowerCase()) return true;
        return (blueprint.aliases ?? []).some((alias) => title.includes(alias));
      });
      if (match) {
        if (match.title.trim().toLowerCase() === normalizedH1Title) {
          continue;
        }
        let sectionContent = match.lines.join("\n");
        sectionContent = sectionContent.replace(
          /^##\s+.*$/m,
          `## ${blueprint.title}`,
        );
        if (blueprint.title === "Business case o motivazione del progetto") {
          sectionContent = sectionContent
            .replace(/^.*\{\{[^{}\n]*budget_preliminare[^{}\n]*\}\}.*$/gim, "")
            .replace(/^.*\{\{[^{}\n]*fonti_finanziarie[^{}\n]*\}\}.*$/gim, "")
            .trim();
        }
        if (
          this.blueprintRequiresMarkdownTable(blueprint) &&
          !this.hasMarkdownTable(sectionContent)
        ) {
          sectionContent = blueprint.lines.join("\n");
        }
        orderedSections.push(sectionContent);
      } else {
        orderedSections.push(blueprint.lines.join("\n"));
      }
    }
    return orderedSections.join("\n\n").trim();
  }

  private blueprintRequiresMarkdownTable(
    blueprint: CharterSectionBlueprint,
  ): boolean {
    return blueprint.lines.some((line) => /^\|(?:\s*:?-+:?\s*\|)+$/.test(line));
  }

  private removeRepeatedGenericSectionHeadings(markdown: string): string {
    const lines = markdown.split(/\r?\n/);
    const firstH1 = lines
      .find((line) => /^\s{0,3}#\s+/.test(line.trim()))
      ?.replace(/^\s{0,3}#\s+/, "")
      .trim()
      .toLowerCase();
    return lines
      .filter((line) => {
        const trimmed = line.trim();
        if (
          /^\s{0,3}#{2,6}\s+(campi compilabili|tavola|input)\s*$/i.test(trimmed)
        ) {
          return false;
        }
        const h2Title = trimmed.match(/^\s{0,3}##\s+(.+)$/)?.[1]?.trim();
        return !firstH1 || h2Title?.toLowerCase() !== firstH1;
      })
      .join("\n");
  }

  private removeRedundantDescriptiveSubsections(markdown: string): string {
    return markdown
      .split(/\r?\n/)
      .filter(
        (line) =>
          !/^\s{0,3}#{2,6}\s+spiegazione\s+descrittiva\s*$/i.test(line.trim()),
      )
      .join("\n");
  }

  private normalizeTablePlaceholders(markdown: string): string {
    return markdown
      .split(/\r?\n/)
      .map((line) => {
        const trimmed = line.trim();
        if (!(trimmed.startsWith("|") && trimmed.endsWith("|"))) return line;
        return line.replace(
          /\{\{text:([a-z_][a-z0-9_]*)\}\}/g,
          (_token, name: string) => `{{string:${name}}}`,
        );
      })
      .join("\n");
  }

  private enforceConsistentFieldTypes(markdown: string): string {
    const fieldTypeByName = new Map<string, string>();
    const preferredTextFields = new Set([
      "descrizione_progetto",
      "business_case",
      "obiettivi_progetto",
      "benefici_attesi",
      "ambito_preliminare",
      "assunzioni_principali",
      "vincoli_principali",
      "rischi_iniziali",
      "rischi_principali",
      "autorita_project_manager",
      "fonti_finanziarie",
    ]);

    return markdown.replace(
      /\{\{([a-z]+):([a-z_][a-z0-9_]*)(:[^{}\n]+)?\}\}/g,
      (
        _token,
        rawType: string,
        fieldName: string,
        rest: string | undefined,
      ) => {
        const type = String(rawType);
        const existing = fieldTypeByName.get(fieldName);
        let chosenType = existing ?? type;
        if (preferredTextFields.has(fieldName)) {
          chosenType = "text";
        } else if (!existing) {
          fieldTypeByName.set(fieldName, chosenType);
        }
        fieldTypeByName.set(fieldName, chosenType);
        return `{{${chosenType}:${fieldName}${rest ?? ""}}}`;
      },
    );
  }

  private enforceExtendedCanonicalPlaceholders(markdown: string): string {
    const defaultsByType: Record<
      string,
      { length: number; required: boolean }
    > = {
      string: { length: 120, required: true },
      text: { length: 400, required: true },
      date: { length: 10, required: true },
      currency: { length: 12, required: true },
      percentage: { length: 5, required: true },
      integer: { length: 6, required: true },
      number: { length: 12, required: true },
      boolean: { length: 5, required: true },
      email: { length: 120, required: true },
      phone: { length: 20, required: true },
    };
    return markdown.replace(
      /\{\{([a-z]+):([a-z_][a-z0-9_]*)(?::([^{}\n:]+))?(?::(true|false))?\}\}/g,
      (
        token,
        typeRaw: string,
        fieldName: string,
        lengthRaw?: string,
        requiredRaw?: string,
      ) => {
        const type = String(typeRaw).toLowerCase();
        if (type === "list") return token;
        const fallback = defaultsByType[type] ?? {
          length: 120,
          required: true,
        };
        const parsedLength = Number(lengthRaw);
        const length =
          Number.isFinite(parsedLength) && parsedLength > 0
            ? Math.floor(parsedLength)
            : fallback.length;
        const required =
          requiredRaw === "true" || requiredRaw === "false"
            ? requiredRaw
            : fallback.required
              ? "true"
              : "false";
        return `{{${type}:${fieldName}:${length}:${required}}}`;
      },
    );
  }

  private toStaticHeadingFromFieldName(fieldName: string): string | null {
    return titleFromFieldName(fieldName);
  }

  private isDescriptiveOpenField(fieldName: string): boolean {
    return /(obiettivi|benefici|descrizione|business_case|ambito|vincoli|assunzioni)/i.test(
      fieldName,
    );
  }

  private derivePromptConstraints(description: string): {
    allowTechnicalPlaceholders: boolean;
    requireTechnicalPlaceholders: boolean;
  } {
    const text = description.toLowerCase();
    const forbidTechnical =
      /(non usare|vieta|senza)\s+placeholder\s+tecnic/.test(text) ||
      /(segnaposto|placeholder).*(testuali|semplici)/.test(text);
    const requireTechnical =
      /(usa|richiedi|obbligatori).*(placeholder|segnaposto).*(tecnic|tipizzat)/.test(
        text,
      );
    return {
      allowTechnicalPlaceholders: !forbidTechnical,
      requireTechnicalPlaceholders: requireTechnical && !forbidTechnical,
    };
  }

  private extractExplicitSectionRequests(description: string): string[] {
    const lines = description.split(/\r?\n/);
    const sectionLines = lines
      .map((line) => line.trim())
      .filter((line) => /^[-*]\s+/.test(line) || /^\d+\.\s+/.test(line))
      .map((line) => line.replace(/^[-*]\s+/, "").replace(/^\d+\.\s+/, ""))
      .filter((line) => line.length > 2);
    const inlineHint =
      description.match(/sezioni?\s+obbligatorie[:\s]+([^\n]+)/i)?.[1] ?? "";
    const inlineSections = inlineHint
      .split(/[;,|]/)
      .map((item) => item.trim())
      .filter((item) => item.length > 2);
    return [...new Set([...sectionLines, ...inlineSections])].slice(0, 12);
  }

  private inferDomain(description: string): InferredGenerationIntent["domain"] {
    const text = description.toLowerCase();
    if (/\b(assicuraz|polizza|massimale|premio|beneficiario)\b/i.test(text))
      return "assicurativo";
    if (/\b(kpi|ricavi|costi|margini|scostamenti|econom)\b/i.test(text))
      return "economico";
    if (/\b(project|milestone|stakeholder|sponsor|pmbok)\b/i.test(text))
      return "project_management";
    if (/\b(api|sistema|architettura|tecnico|specifica)\b/i.test(text))
      return "tecnico";
    if (/\b(amministrativ|protocollo|delibera|determina)\b/i.test(text))
      return "amministrativo";
    if (/\b(commerciale|offerta|cliente|fornitura)\b/i.test(text))
      return "commerciale";
    if (/\b(team|riunione|organizz|processo)\b/i.test(text))
      return "organizzativo";
    return "generico";
  }

  private inferFormality(
    description: string,
  ): InferredGenerationIntent["formality"] {
    const text = description.toLowerCase();
    if (/\b(formale|ufficiale|istituzionale|compliance)\b/i.test(text))
      return "alta";
    if (/\b(rapido|sintetico|operativo|checklist)\b/i.test(text))
      return "operativa";
    return "media";
  }

  private inferGenerationIntent(description: string): InferredGenerationIntent {
    return this.intentClassifier.infer(description);
  }

  private buildInternalGenerationDescription(
    userDescription: string,
    intent: InferredGenerationIntent,
    syntaxSpec?: TemplateSyntaxSpec | null,
  ): string {
    return buildTemplatePromptDescription(
      userDescription,
      intent,
      this.documentBlueprints[intent.archetype],
      this.domainProfiles[intent.domain],
      syntaxSpec,
    );
  }

  private evaluateStructure(markdown: string): {
    valid: boolean;
    issues: string[];
  } {
    const issues: string[] = [];
    if (!/^#\s+\S+/m.test(markdown)) {
      issues.push("Missing H1 title.");
    }
    if (!markdown.match(/\{\{[^{}\n]+\}\}/g)?.length) {
      issues.push("Missing placeholders.");
    }
    return { valid: issues.length === 0, issues };
  }

  private evaluatePromptConformity(
    markdown: string,
    constraints: { allowTechnicalPlaceholders: boolean },
  ): { valid: boolean; issues: string[] } {
    const issues: string[] = [];
    const hasTechnical = /\{\{[a-z]+:[^{}\n]+\}\}/.test(markdown);
    if (!constraints.allowTechnicalPlaceholders && hasTechnical) {
      issues.push(
        "Technical placeholders are forbidden by prompt constraints.",
      );
    }
    const trailingNonTemplateNoteRegex =
      /(?:^|\n)\s*(Questo template(?:\s+e| \u00e8)\s+progettato|Ricorda di)\b/i;
    if (trailingNonTemplateNoteRegex.test(markdown)) {
      issues.push(
        "EXTRA_OUTPUT: testo extra fuori dal template rilevato (nota finale non consentita).",
      );
    }
    const nonExtendedTyped = markdown.match(
      /\{\{([a-z]+):([a-z_][a-z0-9_]*)\}\}/g,
    );
    if (nonExtendedTyped?.length) {
      issues.push(
        `NON_CANONICAL_PLACEHOLDER_FORM: placeholder non estesi rilevati (${nonExtendedTyped.slice(0, 5).join(", ")}). Usare sempre {{tipo:nome:maxLength:required}}.`,
      );
    }
    return { valid: issues.length === 0, issues };
  }

  private evaluateDidacticQuality(markdown: string): DidacticQualityAssessment {
    const lines = markdown.split(/\r?\n/);
    const headingRegex = /^\s{0,3}#{1,6}\s+(.+)$/;
    const sections: Array<{ title: string; lines: string[] }> = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? "";
      const headingMatch = line.match(headingRegex);
      if (!headingMatch) continue;
      const title = (headingMatch[1] ?? "").trim();
      const nextHeadingIndex = lines
        .slice(i + 1)
        .findIndex((candidate) => headingRegex.test(candidate));
      const sectionEnd =
        nextHeadingIndex >= 0 ? i + 1 + nextHeadingIndex : lines.length;
      sections.push({ title, lines: lines.slice(i + 1, sectionEnd) });
    }

    const genericLineRegex =
      /(breve descrizione(?: discorsiva)?|descrizione del contesto e dell[\u2019']obiettivo della sezione|inserire una descrizione|descrivere il progetto|questa sezione contiene|elenco dei|descrizione dei)/i;
    const evaluateSection = (section: {
      title: string;
      lines: string[];
    }): DidacticSectionAssessment => {
      const titleIsGeneric = genericLineRegex.test(section.title);
      const firstPlaceholderLine = section.lines.findIndex((candidate) =>
        /\{\{[^{}\n]+\}\}/.test(candidate),
      );
      if (firstPlaceholderLine < 0) {
        return {
          hasPlaceholder: false,
          hasDescription: false,
          genericDescription: false,
        };
      }
      const descriptionLines = section.lines
        .slice(0, firstPlaceholderLine)
        .filter((candidate) => {
          const trimmed = candidate.trim();
          return (
            trimmed.length > 0 &&
            !trimmed.startsWith("|") &&
            !trimmed.startsWith("- ") &&
            !trimmed.startsWith("* ") &&
            !trimmed.includes("{{")
          );
        });
      if (descriptionLines.length === 0) {
        return {
          hasPlaceholder: true,
          hasDescription: false,
          genericDescription: false,
        };
      }
      const joined = descriptionLines.join(" ").trim();
      const sentenceCount = joined
        .split(/[.!?]+/)
        .map((item) => item.trim())
        .filter(Boolean).length;
      const hasConcreteKeywords =
        /(deve|includere|specificare|motivare|criteri|stakeholder|sponsor|project manager|ambito|rischi|benefici|decisioni)/i.test(
          joined,
        );
      const isGeneric =
        titleIsGeneric ||
        genericLineRegex.test(joined) ||
        sentenceCount < 2 ||
        (!hasConcreteKeywords && joined.length < 180);
      return {
        hasPlaceholder: true,
        hasDescription: true,
        genericDescription: isGeneric,
      };
    };

    const issues: string[] = [];
    let sectionsWithDescription = 0;
    let sectionsMissingDescription = 0;
    let genericDescriptionsCount = 0;
    const placeholderSections = sections
      .map((section) => ({ section, assessment: evaluateSection(section) }))
      .filter(({ assessment }) => assessment.hasPlaceholder);

    for (const { section, assessment } of placeholderSections) {
      if (!assessment.hasDescription) {
        sectionsMissingDescription += 1;
        issues.push(
          `SECTION_DESCRIPTION_MISSING: sezione "${section.title}" senza spiegazione descrittiva prima dei placeholder.`,
        );
        issues.push(
          `PROMPT_CONFORMITY_WARNING: la sezione "${section.title}" deve includere una spiegazione discorsiva utile alla compilazione.`,
        );
        continue;
      }
      if (assessment.genericDescription) {
        genericDescriptionsCount += 1;
        issues.push(
          `SECTION_DESCRIPTION_TOO_GENERIC: sezione "${section.title}" con descrizione troppo generica/non operativa.`,
        );
        continue;
      }
      sectionsWithDescription += 1;
    }

    const total = placeholderSections.length;
    const baseScore =
      total === 0
        ? 100
        : Math.max(0, Math.round((sectionsWithDescription / total) * 100));
    const score = Math.max(0, Math.min(100, baseScore));
    return {
      score,
      sectionsWithDescription,
      sectionsMissingDescription,
      genericDescriptionsCount,
      issues,
    };
  }

  private autoRepairMarkdown(
    markdown: string,
    defaultLength: number,
  ): { markdown: string; changes: string[] } {
    const openCount = (markdown.match(/\{\{/g) ?? []).length;
    const closeCount = (markdown.match(/\}\}/g) ?? []).length;
    if (openCount !== closeCount) {
      return {
        markdown,
        changes: ["repair_skipped_unbalanced_placeholders"],
      };
    }
    const changes: string[] = [];
    const working = markdown.replace(
      /^(\s{0,3}#{1,6}\s+)\{\{([a-z]+):([^\s{}:][^{}]*)\}\}\s*$/gm,
      (line, headingPrefix: string, type: string, rawFieldName: string) => {
        const heading = this.toStaticHeadingFromFieldName(rawFieldName);
        if (!heading) return line;
        const normalizedFieldName = normalizeFieldName(rawFieldName);
        if (!normalizedFieldName) return line;
        changes.push(`title_placeholder:${rawFieldName}->${heading}`);
        return `${headingPrefix}${heading}\n{{${type}:${normalizedFieldName}}}`;
      },
    );
    const repaired = working.replace(/\{\{([^{}\n]+)\}\}/g, (token, inner) => {
      const parts = String(inner)
        .split(":")
        .map((part) => part.trim());
      if (parts.length < 2) return token;
      const type = parts[0] ?? "";
      let fieldName = parts[1] ?? "";
      if (type === "table" || type === "subtable") {
        changes.push(`${type}_placeholder:${fieldName}->string`);
        const normalized = normalizeFieldName(fieldName) || "valore";
        return `{{string:${normalized}:${defaultLength}:true}}`;
      }
      const normalizedFieldName = normalizeFieldName(fieldName);
      if (!normalizedFieldName) return token;
      if (normalizedFieldName && normalizedFieldName !== fieldName) {
        changes.push(`field_name:${fieldName}->${normalizedFieldName}`);
        fieldName = normalizedFieldName;
      }
      if (parts.length >= 3 && !/^\d+$/.test(parts[2] ?? "")) {
        const invalid = parts[2] ?? "";
        parts[2] = String(defaultLength);
        changes.push(`length:${invalid}->${defaultLength}`);
      }
      if (type === "list" && this.isDescriptiveOpenField(fieldName)) {
        changes.push(`list_to_text:${fieldName}->text`);
        return `{{text:${fieldName}}}`;
      }
      if (type === "list" && parts.length === 5 && !parts[4]?.includes(",")) {
        parts[4] = `${parts[4]},${this.defaultListValues}`;
        changes.push(`list_values:temporary->${this.defaultListValues}`);
        changes.push("review_required:list_values_temporary");
      }
      const rebuilt = [type, fieldName, ...parts.slice(2)].join(":");
      return `{{${rebuilt}}}`;
    });
    return { markdown: repaired, changes };
  }

  private normalizePlaceholderFieldNames(markdown: string): {
    markdown: string;
    changes: string[];
  } {
    const changes: string[] = [];
    const normalized = markdown.replace(
      /\{\{([^{}\n]+)\}\}/g,
      (token: string, innerRaw: string) => {
        const inner = String(innerRaw ?? "");
        const parts = inner.split(":").map((part) => part.trim());
        if (parts.length === 0) return token;

        // Legacy token: {{field_name}}
        if (parts.length === 1) {
          const legacyName = parts[0] ?? "";
          const normalizedLegacyName = normalizeFieldName(legacyName);
          if (
            normalizedLegacyName &&
            normalizedLegacyName !== legacyName &&
            /^[a-z_][a-z0-9_]*$/.test(normalizedLegacyName)
          ) {
            changes.push(`field_name:${legacyName}->${normalizedLegacyName}`);
            return `{{${normalizedLegacyName}}}`;
          }
          return token;
        }

        const rawFieldName = parts[1] ?? "";
        const normalizedFieldName = normalizeFieldName(rawFieldName);
        if (normalizedFieldName && normalizedFieldName !== rawFieldName) {
          parts[1] = normalizedFieldName;
          changes.push(`field_name:${rawFieldName}->${normalizedFieldName}`);
        }

        return `{{${parts.join(":")}}}`;
      },
    );
    return { markdown: normalized, changes };
  }

  private uniquifyDuplicatePlaceholderNames(markdown: string): {
    markdown: string;
    changes: string[];
  } {
    const changes: string[] = [];
    const usedNames = new Set<string>();
    const nextIndexByBase = new Map<string, number>();
    const normalized = markdown.replace(
      /\{\{([^{}\n]+)\}\}/g,
      (token: string, innerRaw: string) => {
        const inner = String(innerRaw ?? "");
        const parts = inner.split(":");
        if (parts.length < 2) return token;
        const fieldName = parts[1]?.trim() ?? "";
        if (!fieldName) return token;
        if (!usedNames.has(fieldName)) {
          usedNames.add(fieldName);
          nextIndexByBase.set(fieldName, 2);
          return token;
        }

        const base = fieldName.replace(/_\d+$/, "") || fieldName;
        let nextIndex = nextIndexByBase.get(base) ?? 2;
        let candidate = `${base}_${nextIndex}`;
        while (usedNames.has(candidate)) {
          nextIndex += 1;
          candidate = `${base}_${nextIndex}`;
        }
        nextIndexByBase.set(base, nextIndex + 1);
        usedNames.add(candidate);
        changes.push(`duplicate_field:${fieldName}->${candidate}`);
        parts[1] = candidate;
        return `{{${parts.join(":")}}}`;
      },
    );
    return { markdown: normalized, changes };
  }

  private isRepairApplied(changes: string[]): boolean {
    return (
      changes.length > 0 &&
      !changes.includes("repair_skipped_unbalanced_placeholders")
    );
  }

  private extractRepairedPlaceholders(changes: string[]): string[] {
    const appliedRepairPrefixes = [
      "field_name:",
      "length:",
      "title_placeholder:",
      "table_placeholder:",
      "subtable_placeholder:",
      "list_to_text:",
      "list_values:",
      "duplicate_field:",
      "canonical_placeholders:",
    ];
    return changes
      .filter((change) =>
        appliedRepairPrefixes.some((prefix) => change.startsWith(prefix)),
      )
      .map((change) => change.split("->")[0] ?? change);
  }

  private summarizeBlockingIssuesForRetry(
    result: TemplateDraftGenerationResult,
  ): string {
    const deterministicErrors = result.deterministic.errors
      .filter((issue) => issue.blocking)
      .slice(0, 8)
      .map((issue) => `${issue.code}: ${issue.message}`);
    const promptIssues = result.evaluation.promptConformity.issues
      .slice(0, 4)
      .map((issue) => `PROMPT: ${issue}`);
    const structuralIssues = result.evaluation.structuralCompleteness.issues
      .slice(0, 4)
      .map((issue) => `STRUCTURE: ${issue}`);
    return [...deterministicErrors, ...promptIssues, ...structuralIssues].join(
      "\n- ",
    );
  }

  private buildRetryTableFixInstructions(
    result: TemplateDraftGenerationResult,
  ): string[] {
    const issues = result.deterministic.errors.filter(
      (issue) => issue.code === "MISSING_TABLE_COLUMNS",
    );
    if (issues.length === 0) return [];
    const unique = [...new Set(issues.map((issue) => issue.message.trim()))];
    return [
      "Correggi le tabelle con colonne mancanti rigenerando la tabella completa della sezione indicata.",
      ...unique.map((message) => `- ${message}`),
    ];
  }

  private async buildResultFromMarkdown(params: {
    markdownBeforeRepair: string;
    markdownAfterRepair: string;
    repairChanges: string[];
    runSemanticAudit: boolean;
    constraints: { allowTechnicalPlaceholders: boolean };
    expectedDocumentType?: InferredGenerationIntent["archetype"];
    aiMeta: {
      provider: string;
      model: string | null;
      latencyMs: number;
      failed: boolean;
      error: string | null;
    };
    benchmarkMeta: {
      generationMode: "free" | "guided";
      syntaxSpecIncluded: boolean;
      syntaxSpecVersion: string | null;
      parserVersion: string | null;
      model: string | null;
      numPredict: number | null;
      temperature: number | null;
      generationDurationMs: number;
    };
  }): Promise<TemplateDraftGenerationResult> {
    const beforeReport = await this.templateAuditService.audit({
      content: params.markdownBeforeRepair,
      runAi: false,
      expectedDocumentType: params.expectedDocumentType,
    });
    const afterReport = await this.templateAuditService.audit({
      content: params.markdownAfterRepair,
      runAi: params.runSemanticAudit,
      expectedDocumentType: params.expectedDocumentType,
    });
    const parsed = this.placeholderService.parse(params.markdownAfterRepair);
    const extractedTokens = parsed.fields.map((field) => field.raw);
    const allTokens =
      params.markdownAfterRepair.match(/\{\{[^{}\n]*\}\}/g) ?? [];
    const nonExtractedInvalidPlaceholders = allTokens.filter(
      (token) => !extractedTokens.includes(token),
    );
    const invalidPlaceholders = [
      ...new Set(
        afterReport.deterministic.errors
          .map((issue) => issue.placeholder)
          .filter((item): item is string => Boolean(item)),
      ),
    ];
    const unsupportedTypes = [
      ...new Set(
        afterReport.deterministic.errors
          .filter((issue) => issue.code === "UNSUPPORTED_TYPE")
          .map((issue) => issue.invalidType)
          .filter((item): item is string => Boolean(item)),
      ),
    ];
    const duplicatedPlaceholders = [
      ...new Set(
        afterReport.deterministic.warnings
          .filter((issue) => issue.code === "DUPLICATED_FIELD")
          .map((issue) => issue.fieldName)
          .filter((item): item is string => Boolean(item)),
      ),
    ];
    const placeholdersInTitles = [
      ...new Set(
        afterReport.deterministic.warnings
          .filter((issue) => issue.code === "PLACEHOLDER_IN_TITLE")
          .map((issue) => issue.placeholder)
          .filter((item): item is string => Boolean(item)),
      ),
    ];
    const truncatedOutputErrors = [
      ...new Set(
        afterReport.deterministic.errors
          .filter(
            (issue) =>
              issue.code === "UNCLOSED_PLACEHOLDER" ||
              issue.code === "TABLE_ROW_SPLIT" ||
              issue.code === "OUTPUT_TRUNCATED",
          )
          .map((issue) => issue.code),
      ),
    ];
    const blockingErrorsAfterRepair = afterReport.deterministic.errors.filter(
      (issue) => issue.blocking,
    ).length;
    const structure = this.evaluateStructure(params.markdownAfterRepair);
    const didacticQuality = this.evaluateDidacticQuality(
      params.markdownAfterRepair,
    );
    const promptConformity = this.evaluatePromptConformity(
      params.markdownAfterRepair,
      params.constraints,
    );
    if (
      params.repairChanges.includes("review_required:list_values_temporary")
    ) {
      promptConformity.issues.push(
        "PROMPT_CONFORMITY_WARNING: list values temporanei inseriti automaticamente (Opzione1,Opzione2,Opzione3). Sostituire con opzioni reali.",
      );
    }
    const didacticWarnings = params.runSemanticAudit
      ? didacticQuality.issues.map((issue) => ({
          fieldName: "section_description",
          currentType: "text",
          suggestedType: null,
          reason: issue,
          confidence: 0.9,
          severity: "warning" as const,
        }))
      : [];
    const semanticWarnings = [
      ...(afterReport.ai?.warnings ?? []),
      ...didacticWarnings,
    ];
    const hasBlockingPromptIssue = promptConformity.issues.some((issue) =>
      issue.startsWith("Technical placeholders are forbidden"),
    );
    const validationPassed =
      blockingErrorsAfterRepair === 0 &&
      structure.valid &&
      !hasBlockingPromptIssue &&
      !afterReport.deterministic.warnings.some(
        (issue) => issue.code === "MISSING_REQUIRED_SECTION",
      );
    const errorsAfterRepairCount =
      afterReport.deterministic.errors.length +
      (structure.valid ? 0 : structure.issues.length) +
      (promptConformity.valid ? 0 : promptConformity.issues.length);
    const syntaxErrorTypes = [
      ...new Set(afterReport.deterministic.errors.map((issue) => issue.code)),
    ];
    const repairApplied = this.isRepairApplied(params.repairChanges);
    const repairableErrorsAvailable = beforeReport.deterministic.errors.some(
      (issue) => issue.autoFixable,
    );
    const repairedPlaceholders = this.extractRepairedPlaceholders(
      params.repairChanges,
    );

    return {
      content: params.markdownAfterRepair,
      fields: afterReport.deterministic.fields,
      placeholderAnalysis: {
        extractedFields: parsed.fields.map((field) => ({
          raw: field.raw,
          type: field.type,
          name: field.name,
        })),
        validFields: parsed.fields.map((field) => ({
          raw: field.raw,
          type: field.type,
          name: field.name,
        })),
        invalidPlaceholders,
        syntaxErrors: afterReport.deterministic.errors.map(
          (issue) => issue.message,
        ),
        unsupportedTypes,
        duplicatedPlaceholders,
        placeholdersInTitles,
        truncatedOutputErrors,
        nonExtractedInvalidPlaceholders,
        repairableErrors: beforeReport.deterministic.errors
          .filter((issue) => issue.autoFixable)
          .map((issue) => issue.code),
        nonRepairableErrors: afterReport.deterministic.errors
          .filter((issue) => !issue.autoFixable)
          .map((issue) => issue.code),
        repairableErrorsAvailable,
        repairApplied,
        blockingErrorsAfterRepair,
        sectionsWithDescription: didacticQuality.sectionsWithDescription,
        sectionsMissingDescription: didacticQuality.sectionsMissingDescription,
        genericDescriptionsCount: didacticQuality.genericDescriptionsCount,
        didacticQualityScore: didacticQuality.score,
      },
      deterministic: {
        errors: afterReport.deterministic.errors,
        warnings: afterReport.deterministic.warnings,
        durationMs: afterReport.deterministic.durationMs,
      },
      semanticAudit: {
        warnings: semanticWarnings,
      },
      ai: params.aiMeta,
      benchmark: {
        model: params.benchmarkMeta.model,
        numPredict: params.benchmarkMeta.numPredict,
        temperature: params.benchmarkMeta.temperature,
        auditEnabled: Boolean(params.runSemanticAudit),
        generationDurationMs: params.benchmarkMeta.generationDurationMs,
        outputLength: params.markdownAfterRepair.length,
        syntaxErrorCount: afterReport.deterministic.errors.length,
        syntaxErrorTypes,
        outputComplete: structure.valid,
        validationPassed,
        repairApplied,
        syntaxSpecIncluded: params.benchmarkMeta.syntaxSpecIncluded,
        syntaxSpecVersion: params.benchmarkMeta.syntaxSpecVersion,
        parserVersion: params.benchmarkMeta.parserVersion,
        generationMode: params.benchmarkMeta.generationMode,
      },
      evaluation: {
        syntaxValidity: {
          valid: blockingErrorsAfterRepair === 0,
          issues: afterReport.deterministic.errors.map(
            (issue) => issue.message,
          ),
        },
        structuralCompleteness: structure,
        semanticQuality: {
          valid: semanticWarnings.length === 0,
          issues: semanticWarnings.map((warning) => warning.reason),
        },
        promptConformity,
        didacticQuality: {
          valid: didacticQuality.score >= 70,
          issues: didacticQuality.issues,
          score: didacticQuality.score,
          sectionsWithDescription: didacticQuality.sectionsWithDescription,
          sectionsMissingDescription:
            didacticQuality.sectionsMissingDescription,
          genericDescriptionsCount: didacticQuality.genericDescriptionsCount,
        },
      },
      repair: {
        applied: repairApplied,
        changes: params.repairChanges,
        errorsBeforeRepair: beforeReport.deterministic.errors.length,
        repairableErrorsAvailable,
        repairAppliedCount: repairedPlaceholders.length,
        repairedPlaceholders,
        errorsAfterRepair: errorsAfterRepairCount,
        blockingErrorsAfterRepair,
        finalValidationPassed: validationPassed,
      },
      savable: validationPassed,
    };
  }

  async generateDraft(
    input: GenerateTemplateDraftInput,
  ): Promise<TemplateDraftGenerationResult> {
    const provider = this.resolveProvider();
    const syntaxProfile = this.getGenerationSyntaxProfile();

    let markdown = "";
    let markdownBeforeRepair = "";
    let model: string | null = null;
    let latencyMs = 0;
    let failed = false;
    let error: string | null = null;
    let repairChanges: string[] = [];

    const constraints = this.derivePromptConstraints(input.description);
    const intent = this.inferGenerationIntent(input.description);
    const generationMode = input.generationMode ?? "guided";
    const repairLength = Number.isFinite(input.defaultLength)
      ? Math.max(1, Math.floor(input.defaultLength as number))
      : this.defaultRepairLength;
    const autoRepair = input.autoRepair !== false;
    // Always pass official syntax spec to the provider so prompt constraints
    // come from the same source of truth used by parser/validator.
    const syntaxSpec = this.getGenerationSyntaxSpec();
    const baseInternalDescription = this.buildInternalGenerationDescription(
      input.description,
      intent,
      syntaxSpec,
    );

    let internalDescription = baseInternalDescription;
    let result: TemplateDraftGenerationResult | null = null;
    for (let attempt = 0; attempt <= this.maxGenerationRetries; attempt += 1) {
      try {
        const generated = await provider.generateTemplateDraft({
          description: internalDescription,
          language: input.language,
          syntaxProfile: {
            fieldNamePattern: syntaxProfile.fieldNamePattern,
            supportedTypes: [...syntaxProfile.supportedTypes],
            variants: syntaxProfile.variants,
          },
          generationMode,
          syntaxSpec,
          outputConstraints: constraints,
        });
        markdown = this.sanitizeGeneratedMarkdown(generated.markdown);

        const isDebugOrTest =
          process.env.NODE_ENV === "development" ||
          process.env.NODE_ENV === "test" ||
          process.env.DEBUG_OLLAMA === "true";

        if (isDebugOrTest) {
          this.logger.log(
            `[DEBUG_OLLAMA_PIPELINE] Dominio rilevato: ${intent.domain}, Archetype/Profilo attivo: ${intent.archetype}`,
          );
          this.logger.log(
            `[DEBUG_OLLAMA_PIPELINE] Prompt completo inviato:\n${internalDescription}`,
          );
          this.logger.log(
            `[DEBUG_OLLAMA_PIPELINE] Output grezzo restituito da Ollama:\n${generated.markdown}`,
          );
        }

        const postProcessed = this.postProcessGeneratedMarkdown(
          markdown,
          intent.archetype,
          autoRepair,
          repairLength,
        );
        markdown = postProcessed.markdown;

        if (isDebugOrTest) {
          this.logger.log(
            `[DEBUG_OLLAMA_PIPELINE] Output dopo post-processing:\n${markdown}`,
          );
        }

        model = generated.model;
        latencyMs = generated.latencyMs;
        markdownBeforeRepair = markdown;
        repairChanges = postProcessed.changes;
      } catch (generationError) {
        failed = true;
        error =
          generationError instanceof Error
            ? generationError.message
            : String(generationError);
        markdown = "";
        markdownBeforeRepair = "";
      }

      result = await this.buildResultFromMarkdown({
        markdownBeforeRepair: markdownBeforeRepair || markdown,
        markdownAfterRepair: markdown,
        repairChanges,
        runSemanticAudit: input.runSemanticAudit ?? false,
        constraints,
        expectedDocumentType: intent.archetype,
        aiMeta: {
          provider: provider.name,
          model,
          latencyMs,
          failed,
          error,
        },
        benchmarkMeta: {
          generationMode,
          syntaxSpecIncluded: Boolean(syntaxSpec),
          syntaxSpecVersion: syntaxSpec?.version ?? null,
          parserVersion: syntaxSpec?.parserVersion ?? null,
          model,
          numPredict:
            provider.name === "ollama"
              ? Number(process.env.OLLAMA_DRAFT_NUM_PREDICT ?? 700)
              : null,
          temperature:
            provider.name === "ollama"
              ? Number(process.env.OLLAMA_DRAFT_TEMPERATURE ?? 0.2)
              : null,
          generationDurationMs: latencyMs,
        },
      });

      const isDebugOrTest =
        process.env.NODE_ENV === "development" ||
        process.env.NODE_ENV === "test" ||
        process.env.DEBUG_OLLAMA === "true";

      if (isDebugOrTest && result) {
        this.logger.log(
          `[DEBUG_OLLAMA_PIPELINE] Errori di validazione finale: ${JSON.stringify(result.deterministic.errors)}`,
        );
      }

      if (result.savable || attempt >= this.maxGenerationRetries) break;
      const summary = this.summarizeBlockingIssuesForRetry(result);
      const tableFixInstructions = this.buildRetryTableFixInstructions(result);
      internalDescription = [
        baseInternalDescription,
        "",
        "[RETRY_DELTA_PROMPT]",
        `attempt=${attempt + 2}`,
        "Correggi il template precedente usando SOLO Markdown valido.",
        "Errori bloccanti da correggere:",
        `- ${summary || "nessun dettaglio disponibile"}`,
        ...tableFixInstructions,
        "Non usare placeholder di tipo table o subtable: crea tabelle Markdown normali con placeholder ufficiali nelle celle.",
        "Normalizza sempre i field_name in snake_case ASCII e usa forma canonica {{tipo:nome:maxLength:required}}.",
        "Mantieni contenuto valido gia presente e correggi solo gli errori.",
        "[END_RETRY_DELTA_PROMPT]",
      ].join("\n");
    }
    if (!result) {
      result = await this.buildResultFromMarkdown({
        markdownBeforeRepair: markdownBeforeRepair || markdown,
        markdownAfterRepair: markdown,
        repairChanges,
        runSemanticAudit: input.runSemanticAudit ?? false,
        constraints,
        expectedDocumentType: intent.archetype,
        aiMeta: {
          provider: provider.name,
          model,
          latencyMs,
          failed,
          error,
        },
        benchmarkMeta: {
          generationMode,
          syntaxSpecIncluded: Boolean(syntaxSpec),
          syntaxSpecVersion: syntaxSpec?.version ?? null,
          parserVersion: syntaxSpec?.parserVersion ?? null,
          model,
          numPredict:
            provider.name === "ollama"
              ? Number(process.env.OLLAMA_DRAFT_NUM_PREDICT ?? 700)
              : null,
          temperature:
            provider.name === "ollama"
              ? Number(process.env.OLLAMA_DRAFT_TEMPERATURE ?? 0.2)
              : null,
          generationDurationMs: latencyMs,
        },
      });
    }
    this.logger.log(
      `Template draft benchmark: ${JSON.stringify(result.benchmark)}`,
    );
    return result;
  }

  async repairDraft(
    input: RepairTemplateDraftInput,
  ): Promise<TemplateDraftGenerationResult> {
    const provider = this.resolveProvider();
    const generationMode = input.generationMode ?? "guided";
    const syntaxSpec =
      generationMode === "guided"
        ? this.placeholderService.buildTemplateSyntaxSpec()
        : null;
    const repairedLength = Number.isFinite(input.defaultLength)
      ? Math.max(1, Math.floor(input.defaultLength as number))
      : Math.max(1, this.defaultRepairLength);
    const original = input.content ?? "";
    this.logger.log(
      `template_repair_requested ${JSON.stringify({
        inputLength: original.length,
        generationMode,
        runSemanticAudit: input.runSemanticAudit ?? false,
      })}`,
    );
    const structural =
      this.repairUnsupportedStructuralPlaceholderTypes(original);
    const repaired = this.autoRepairMarkdown(
      structural.markdown,
      repairedLength,
    );
    const normalizedPlaceholders = this.normalizePlaceholderFieldNames(
      repaired.markdown,
    );
    const uniqueNames = this.uniquifyDuplicatePlaceholderNames(
      normalizedPlaceholders.markdown,
    );
    const canonicalMarkdown = this.enforceExtendedCanonicalPlaceholders(
      uniqueNames.markdown,
    );
    const canonicalChanges =
      canonicalMarkdown === normalizedPlaceholders.markdown
        ? []
        : ["canonical_placeholders:extended"];
    const mergedChanges = [
      ...structural.changes,
      ...repaired.changes,
      ...normalizedPlaceholders.changes,
      ...uniqueNames.changes,
      ...canonicalChanges,
    ];
    const constraints = this.derivePromptConstraints("usa placeholder tecnici");
    const result = await this.buildResultFromMarkdown({
      markdownBeforeRepair: original,
      markdownAfterRepair: canonicalMarkdown,
      repairChanges: mergedChanges,
      runSemanticAudit: input.runSemanticAudit ?? false,
      constraints,
      aiMeta: {
        provider: provider.name,
        model: null,
        latencyMs: 0,
        failed: false,
        error: null,
      },
      benchmarkMeta: {
        generationMode,
        syntaxSpecIncluded: Boolean(syntaxSpec),
        syntaxSpecVersion: syntaxSpec?.version ?? null,
        parserVersion: syntaxSpec?.parserVersion ?? null,
        model: null,
        numPredict:
          provider.name === "ollama"
            ? Number(process.env.OLLAMA_DRAFT_NUM_PREDICT ?? 700)
            : null,
        temperature:
          provider.name === "ollama"
            ? Number(process.env.OLLAMA_DRAFT_TEMPERATURE ?? 0.2)
            : null,
        generationDurationMs: 0,
      },
      expectedDocumentType: "generic_template",
    });
    this.logger.log(
      `template_repair_completed ${JSON.stringify({
        inputLength: original.length,
        outputLength: result.content.length,
        changed: result.content !== original,
        applied: result.repair.applied,
        repairAppliedCount: result.repair.repairAppliedCount,
        errorsBefore: result.repair.errorsBeforeRepair,
        errorsAfter: result.repair.errorsAfterRepair,
        blockingErrorsAfterRepair: result.repair.blockingErrorsAfterRepair,
      })}`,
    );
    return result;
  }
}
