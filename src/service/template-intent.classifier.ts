import {
  DOCUMENT_ARCHETYPE_DEFAULTS,
  type SupportedDocumentType,
} from "./template-profiles/document-type.profiles";
import {
  DOMAIN_PROFILES,
  type SupportedDomain,
} from "./template-profiles/domain.profiles";

export interface InferredGenerationIntent {
  archetype: SupportedDocumentType;
  domain: SupportedDomain;
  purpose: string;
  audience: string[];
  formality: "alta" | "media" | "operativa";
  requiredSectionsFromPrompt: string[];
  suggestedSections: string[];
  suggestedFields: string[];
}

export class TemplateIntentClassifier {
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

  private inferDomain(description: string): SupportedDomain {
    const text = description.toLowerCase();
    if (/\b(assicuraz|polizza|massimale|premio|beneficiario)\b/i.test(text))
      return "assicurativo";
    if (
      /\b(kpi|ricavi|costi|margini|scostamenti|economico|economica|economici|bilancio|conto economico)\b/i.test(
        text,
      )
    )
      return "economico";
    if (
      /\b(project|progetto|milestone|stakeholder|sponsor|pmbok)\b/i.test(text)
    )
      return "project_management";
    if (
      /\b(api|sistema|architettura|tecnico|specifica|capitolato tecnico|requisiti tecnici)\b/i.test(
        text,
      )
    )
      return "tecnico";
    if (
      /\b(amministrativo|amministrativa|protocollo|delibera|determina|pratica amministrativa)\b/i.test(
        text,
      )
    )
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

  infer(description: string): InferredGenerationIntent {
    const text = description.toLowerCase();
    const contains = (pattern: RegExp) => pattern.test(text);
    const requiredSectionsFromPrompt =
      this.extractExplicitSectionRequests(description);
    const domain = this.inferDomain(description);
    const formality = this.inferFormality(description);

    const isCharter = contains(
      /\b(project charter|charter di progetto|charter progetto)\b/i,
    );
    if (isCharter) {
      const selected = DOCUMENT_ARCHETYPE_DEFAULTS.project_charter;
      return {
        archetype: "project_charter",
        domain: "project_management",
        purpose: selected.purpose,
        audience: ["sponsor", "project_manager", "stakeholder"],
        formality,
        requiredSectionsFromPrompt,
        suggestedSections: selected.sections,
        suggestedFields: selected.fields,
      };
    }

    if (
      contains(/\b(capitolato|specifica tecnica|specifich(?:e|a) tecnica)\b/i)
    ) {
      const selected = DOCUMENT_ARCHETYPE_DEFAULTS.capitolato;
      return {
        archetype: "capitolato",
        domain,
        purpose: selected.purpose,
        audience: ["ufficio_acquisti", "fornitore", "stakeholder"],
        formality,
        requiredSectionsFromPrompt,
        suggestedSections: selected.sections,
        suggestedFields: selected.fields,
      };
    }

    if (contains(/\b(verbale|riunione|meeting)\b/i)) {
      const selected = DOCUMENT_ARCHETYPE_DEFAULTS.verbale;
      return {
        archetype: "verbale",
        domain,
        purpose: selected.purpose,
        audience: ["partecipanti", "responsabili", "stakeholder"],
        formality,
        requiredSectionsFromPrompt,
        suggestedSections: selected.sections,
        suggestedFields: selected.fields,
      };
    }

    if (contains(/\b(piano di progetto|project plan|piano progetto)\b/i)) {
      const selected = DOCUMENT_ARCHETYPE_DEFAULTS.project_plan;
      return {
        archetype: "project_plan",
        domain,
        purpose: selected.purpose,
        audience: ["project_manager", "team", "sponsor"],
        formality,
        requiredSectionsFromPrompt,
        suggestedSections: selected.sections,
        suggestedFields: selected.fields,
      };
    }

    if (
      contains(
        /\b(documento amministrativo|documento amministrativa|pratica amministrativa)\b/i,
      )
    ) {
      const selected = DOCUMENT_ARCHETYPE_DEFAULTS.procedure;
      return {
        archetype: "procedure",
        domain: "amministrativo",
        purpose: selected.purpose,
        audience: ["responsabili", "operatori", "stakeholder"],
        formality,
        requiredSectionsFromPrompt,
        suggestedSections: selected.sections,
        suggestedFields: selected.fields,
      };
    }

    if (contains(/\b(documento tecnico|scheda tecnica)\b/i)) {
      const selected = DOCUMENT_ARCHETYPE_DEFAULTS.requirements_document;
      return {
        archetype: "requirements_document",
        domain: "tecnico",
        purpose: selected.purpose,
        audience: ["responsabili", "operatori", "stakeholder"],
        formality,
        requiredSectionsFromPrompt,
        suggestedSections: selected.sections,
        suggestedFields: selected.fields,
      };
    }

    if (contains(/\b(documento economico|analisi economica)\b/i)) {
      const selected = DOCUMENT_ARCHETYPE_DEFAULTS.report;
      return {
        archetype: "report",
        domain: "economico",
        purpose: selected.purpose,
        audience: ["responsabili", "operatori", "stakeholder"],
        formality,
        requiredSectionsFromPrompt,
        suggestedSections: selected.sections,
        suggestedFields: selected.fields,
      };
    }

    if (contains(/\b(documento assicurativ|scheda assicurativa|polizza)\b/i)) {
      const selected = DOCUMENT_ARCHETYPE_DEFAULTS.scheda;
      return {
        archetype: "scheda",
        domain: "assicurativo",
        purpose: selected.purpose,
        audience: ["responsabili", "operatori", "stakeholder"],
        formality,
        requiredSectionsFromPrompt,
        suggestedSections: selected.sections,
        suggestedFields: selected.fields,
      };
    }

    if (
      contains(/\b(template generico|documento generico)\b/i) &&
      !contains(/\b(procedura|procedurale|workflow|processo|istruzioni)\b/i)
    ) {
      const selected = DOCUMENT_ARCHETYPE_DEFAULTS.generic_template;
      return {
        archetype: "generic_template",
        domain,
        purpose: selected.purpose,
        audience: ["stakeholder"],
        formality,
        requiredSectionsFromPrompt,
        suggestedSections: selected.sections,
        suggestedFields: selected.fields,
      };
    }

    const score = {
      capitolato: 0,
      verbale: 0,
      project_plan: 0,
      scheda: 0,
      checklist: 0,
      policy: 0,
      procedure: 0,
      report: 0,
      requirements: 0,
    };
    if (contains(/\b(capitolato|specifica tecnica|fornitura)\b/i))
      score.capitolato += 2;
    if (contains(/\b(verbale|riunione|meeting)\b/i)) score.verbale += 2;
    if (
      contains(/\b(piano di progetto|project plan|pianificazione progetto)\b/i)
    )
      score.project_plan += 2;
    if (contains(/\b(policy|regolamento|linee guida|compliance|regole)\b/i))
      score.policy += 2;
    if (contains(/\b(procedura|procedurale|workflow|processo|istruzioni)\b/i))
      score.procedure += 2;
    if (
      contains(
        /\b(report|resoconto|monitoraggio|stato avanzamento|economico)\b/i,
      )
    )
      score.report += 2;
    if (contains(/\b(scheda|anagrafica|informativa|polizza)\b/i))
      score.scheda += 2;
    if (
      contains(/\b(assicurativa|assicurativo)\b/i) &&
      contains(/\b(scheda|anagrafica|informativa|polizza)\b/i)
    )
      score.scheda += 2;
    if (contains(/\b(checklist|check list|lista controllo)\b/i))
      score.checklist += 2;
    if (contains(/\b(requisiti|specifiche|vincoli tecnici|alto livello)\b/i))
      score.requirements += 2;
    if (
      contains(
        /\b(documento amministrativo|documento amministrativa|pratica amministrativa)\b/i,
      )
    )
      score.procedure += 2;
    if (contains(/\b(documento tecnico)\b/i)) score.requirements += 2;
    if (contains(/\b(documento economico)\b/i)) score.report += 2;
    if (contains(/\b(approvazione|escalation|controlli)\b/i)) {
      score.policy += 1;
      score.procedure += 1;
    }

    const best = Object.entries(score).sort((a, b) => b[1] - a[1])[0];
    const archetype: SupportedDocumentType =
      !best || best[1] === 0
        ? "generic_template"
        : best[0] === "capitolato"
          ? "capitolato"
          : best[0] === "verbale"
            ? "verbale"
            : best[0] === "project_plan"
              ? "project_plan"
              : best[0] === "scheda"
                ? "scheda"
                : best[0] === "checklist"
                  ? "checklist"
                  : best[0] === "policy"
                    ? "policy"
                    : best[0] === "procedure"
                      ? "procedure"
                      : best[0] === "report"
                        ? "report"
                        : "requirements_document";

    const genericAudience = contains(
      /\b(utenti|team|operatori|responsabili)\b/i,
    )
      ? ["responsabili", "operatori", "stakeholder"]
      : ["stakeholder"];

    const domainProfile = DOMAIN_PROFILES[domain];
    const selected = DOCUMENT_ARCHETYPE_DEFAULTS[archetype];
    const suggestedSections = selected.sections;
    const suggestedFields = selected.fields;

    return {
      archetype,
      domain,
      purpose: selected.purpose,
      audience: genericAudience,
      formality,
      requiredSectionsFromPrompt,
      suggestedSections,
      suggestedFields,
    };
  }
}
