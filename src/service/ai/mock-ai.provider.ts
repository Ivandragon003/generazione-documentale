import { Injectable } from "@nestjs/common";
import type { AiSemanticWarning } from "../../common/types/template-audit.type";
import type {
  AiProvider,
  AiTemplateAuditInput,
  AiTemplateAuditResult,
  AiTemplateDraftInput,
  AiTemplateDraftResult,
} from "./ai-provider.interface";

const RULES: Array<{
  pattern: RegExp;
  whenTypes: string[];
  type: string;
  reason: string;
  confidence: number;
}> = [
  {
    pattern: /\b(data di nascita|nascita|data nascita)\b/i,
    whenTypes: ["string", "text"],
    type: "date",
    reason:
      "Il contesto testuale suggerisce un valore temporale (data di nascita).",
    confidence: 0.8,
  },
  {
    pattern: /\b(data scadenza contratto|scadenza contratto|data scadenza)\b/i,
    whenTypes: ["string", "text"],
    type: "date",
    reason:
      "Il contesto testuale suggerisce un valore temporale (data scadenza contratto).",
    confidence: 0.82,
  },
  {
    pattern: /\b(data stipula|stipula)\b/i,
    whenTypes: ["string", "text"],
    type: "date",
    reason:
      "Il contesto testuale suggerisce un valore temporale (data stipula).",
    confidence: 0.8,
  },
  {
    pattern: /\b(importo totale|importo|totale|prezzo|costo|euro|eur)\b/i,
    whenTypes: ["string", "text"],
    type: "currency",
    reason: "Il contesto testuale sembra riferirsi a un importo monetario.",
    confidence: 0.85,
  },
  {
    pattern: /\b(percentuale sconto|percentuale|sconto|iva|%)\b/i,
    whenTypes: ["string", "integer"],
    type: "percentage",
    reason: "Il contesto testuale sembra riferirsi a una percentuale.",
    confidence: 0.84,
  },
  {
    pattern: /\b(attivo|obbligatorio)\b/i,
    whenTypes: ["string", "text"],
    type: "boolean",
    reason: "Il contesto testuale sembra esprimere uno stato booleano.",
    confidence: 0.8,
  },
  {
    pattern: /\b(numero dipendenti|dipendenti)\b/i,
    whenTypes: ["currency", "string"],
    type: "integer",
    reason: "Il contesto testuale sembra riferirsi a una quantita intera.",
    confidence: 0.83,
  },
];

@Injectable()
export class MockAiProvider implements AiProvider {
  readonly name = "mock";

  async generateTemplateDraft(
    input: AiTemplateDraftInput,
  ): Promise<AiTemplateDraftResult> {
    const started = Date.now();
    const naturalPrompt =
      input.description.split("[BACKEND_INTENT_NORMALIZATION]")[0]?.trim() ??
      input.description;
    const description = naturalPrompt.toLowerCase();
    const language = (input.language ?? "it").toLowerCase();
    const titleLabel =
      language.startsWith("en") || language.startsWith("us")
        ? "Document draft"
        : "Bozza documento";
    const title = `# ${titleLabel}`;

    const lines: string[] = [title, ""];

    const include = {
      contract: /\b(contratto|fornitura|supplier|agreement)\b/i.test(
        description,
      ),
      meeting: /\b(verbale|riunione|meeting)\b/i.test(description),
      offer: /\b(offerta|commerciale|preventivo|proposal|quote)\b/i.test(
        description,
      ),
      customer: /\b(anagrafica|cliente|customer)\b/i.test(description),
      monthly: /\b(mensile|monthly|attivita)\b/i.test(description),
      charter:
        /\b(project charter|charter di progetto|charter progetto)\b/i.test(
          description,
        ),
      healthcare:
        /\b(sanit\w*|ospedal\w*|infermier\w*|dottor\w*|medic\w*)/i.test(
          description,
        ),
      regulation: /\b(regolament|regole|linee guida|compliance)\b/i.test(
        description,
      ),
      emergency:
        /\b(emergenz\w*|incident\w*|evacuazion\w*|crisi|allarme)\b/i.test(
          description,
        ),
      procedure: /\b(procedur|operativ|workflow|processo)\b/i.test(description),
      checklist: /\b(checklist|check list|lista controllo)\b/i.test(
        description,
      ),
      capitolato: /\b(capitolato|specifica tecnica)\b/i.test(description),
      reportEconomico:
        /\b(report economico|report|ricavi|costi|margini|kpi)\b/i.test(
          description,
        ),
      schedaAssicurativa: /\b(scheda assicurativa|assicurativ|polizza)\b/i.test(
        description,
      ),
      pianoOperativo:
        /\b(piano operativo|piano di progetto|project plan)\b/i.test(
          description,
        ),
      amministrativo:
        /\b(amministrativ|pratica amministrativa|protocollo|delibera)\b/i.test(
          description,
        ),
    };

    const strictExample =
      input.syntaxProfile.variants.find((variant) => variant.id === "strict")
        ?.example ?? "{{string:nome_campo}}";
    const strictPrefix = strictExample.startsWith("{{")
      ? strictExample.split(":")[0]
      : "{{string";

    const supportedTypeSet = new Set(input.syntaxProfile.supportedTypes);
    const resolveType = (
      preferred: string,
      fallback: string,
      secondaryFallback = "string",
    ): string => {
      if (supportedTypeSet.has(preferred as never)) return preferred;
      if (supportedTypeSet.has(fallback as never)) return fallback;
      if (supportedTypeSet.has(secondaryFallback as never))
        return secondaryFallback;
      return "string";
    };

    const token = (preferredType: string, name: string, fallback?: string) => {
      const type = resolveType(preferredType, fallback ?? "string");
      return `${strictPrefix.replace(/^\{\{[a-z]+$/, `{{${type}`)}:${name}}}`;
    };

    const hasListExtended =
      supportedTypeSet.has("list" as never) &&
      input.syntaxProfile.variants.some(
        (variant) => variant.id === "extendedList",
      );
    const listToken = hasListExtended
      ? "{{list:stato_cliente:40:true:stati_cliente,Attivo,Prospect,Sospeso}}"
      : token("string", "stato_cliente");

    if (include.contract) {
      lines.push(
        "## Contratto",
        `Cliente: ${token("string", "nome_cliente")}`,
        `Data stipula: ${token("date", "data_stipula")}`,
        `Importo totale: ${token("currency", "importo_totale", "integer")}`,
        `Durata (mesi): ${token("integer", "durata_mesi")}`,
      );
    }

    if (include.meeting) {
      lines.push(
        "## Riunione",
        `Data riunione: ${token("date", "data_riunione")}`,
        `Partecipanti: ${token("text", "partecipanti")}`,
        `Decisioni: ${token("text", "decisioni")}`,
      );
    }

    if (include.offer) {
      lines.push(
        "## Offerta",
        `Oggetto: ${token("text", "oggetto_offerta")}`,
        `Prezzo proposto: ${token("currency", "prezzo_proposto", "integer")}`,
        `Validita (giorni): ${token("integer", "validita_giorni")}`,
      );
    }

    if (include.customer) {
      lines.push(
        "## Cliente",
        `Ragione sociale: ${token("string", "ragione_sociale")}`,
        `Email referente: ${token("email", "email_referente")}`,
        `Telefono referente: ${token("phone", "telefono_referente")}`,
        `Stato cliente: ${listToken}`,
      );
    }

    if (include.monthly) {
      lines.push(
        "## Report mensile",
        `Mese riferimento: ${token("string", "mese_riferimento")}`,
        `Attivita principali: ${token("text", "attivita_principali")}`,
        `Avanzamento percentuale: ${token("percentage", "avanzamento_percentuale", "integer")}`,
      );
    }

    if (include.reportEconomico) {
      lines.push(
        "## Periodo di riferimento",
        `Periodo: ${token("string", "periodo_riferimento")}`,
        "## KPI principali",
        "| KPI | Valore | Target |",
        "|---|---|---|",
        `| ${token("string", "kpi_1")} | ${token("currency", "valore_kpi_1", "integer")} | ${token("currency", "target_kpi_1", "integer")} |`,
        "## Ricavi",
        `Ricavi totali: ${token("currency", "ricavi_totali", "integer")}`,
        "## Costi",
        `Costi totali: ${token("currency", "costi_totali", "integer")}`,
        "## Margini",
        `Margine operativo: ${token("currency", "margine_operativo", "integer")}`,
        "## Analisi scostamenti",
        `Analisi: ${token("text", "analisi_scostamenti")}`,
        "## Rischi",
        `Rischio economico principale: ${token("text", "rischio_economico_1")}`,
        "## Conclusioni",
        `Conclusioni: ${token("text", "conclusioni_report")}`,
      );
    }

    if (include.schedaAssicurativa) {
      lines.push(
        "## Dati polizza",
        `Numero polizza: ${token("string", "numero_polizza")}`,
        "## Contraente",
        `Nome contraente: ${token("string", "nome_contraente")}`,
        "## Coperture",
        "| Copertura | Descrizione | Limiti |",
        "|---|---|---|",
        `| ${token("string", "copertura_1")} | ${token("string", "descrizione_copertura_1")} | ${token("string", "limiti_copertura_1")} |`,
        "## Massimali",
        `Massimale principale: ${token("currency", "massimale_1", "integer")}`,
        "## Esclusioni",
        `Esclusione principale: ${token("string", "esclusione_1")}`,
        "## Premio",
        `Premio annuo: ${token("currency", "premio_annuo", "integer")}`,
        "## Durata",
        `Durata polizza: ${token("string", "durata_polizza")}`,
        "## Beneficiario",
        `Beneficiario principale: ${token("string", "beneficiario_1")}`,
      );
    }

    if (include.checklist) {
      lines.push(
        "## Scopo",
        `Scopo checklist: ${token("text", "scopo_checklist")}`,
        "## Voci di controllo",
        "| Area | Controllo | Esito | Note | Responsabile |",
        "|---|---|---|---|---|",
        `| ${token("string", "area_controllo_1")} | ${token("string", "voce_controllo_1")} | ${token("string", "esito_controllo_1")} | ${token("string", "note_controllo_1")} | ${token("string", "responsabile_controllo_1")} |`,
        "## Esito",
        `Esito generale: ${token("string", "esito_generale")}`,
      );
    }

    if (include.pianoOperativo) {
      lines.push(
        "## Obiettivi",
        `Obiettivi: ${token("text", "obiettivi_piano")}`,
        "## Attivita",
        "| Attivita | Responsabile | Scadenza | Stato |",
        "|---|---|---|---|",
        `| ${token("string", "attivita_1")} | ${token("string", "responsabile_attivita_1")} | ${token("date", "scadenza_attivita_1")} | ${token("string", "stato_attivita_1")} |`,
        "## Milestone",
        `Milestone principale: ${token("string", "milestone_1")}`,
        "## KPI",
        `KPI principale: ${token("string", "kpi_1")}`,
      );
    }

    if (include.capitolato) {
      lines.push(
        "## Oggetto e contesto",
        `Oggetto: ${token("string", "oggetto_fornitura")}`,
        "## Ambito della fornitura",
        `Ambito: ${token("text", "ambito_fornitura")}`,
        "## Requisiti tecnici",
        "| Requisito | Descrizione | Priorita |",
        "|---|---|---|",
        `| ${token("string", "requisito_tecnico_1")} | ${token("string", "descrizione_requisito_tecnico_1")} | ${token("string", "priorita_requisito_tecnico_1")} |`,
        "## Criteri di accettazione",
        `Criterio principale: ${token("text", "criterio_accettazione_1")}`,
      );
    }

    if (include.amministrativo) {
      lines.push(
        "## Scopo e contesto",
        `Scopo: ${token("text", "scopo_documento")}`,
        "## Ruoli coinvolti",
        `Responsabile pratica: ${token("string", "responsabile_pratica")}`,
        "## Passaggi operativi",
        `Passaggio 1: ${token("text", "passaggio_1")}`,
        "## Controlli e approvazioni",
        `Stato approvazione: ${token("string", "stato_approvazione")}`,
      );
    }

    if (include.charter) {
      lines.push(
        "## Project Charter",
        "Questa sezione identifica il progetto e fissa le informazioni minime per sponsor e project manager.",
        "Specificare nome, date e sintesi iniziale aiuta a collegare obiettivi, vincoli e decisioni successive.",
        `Nome progetto: ${token("string", "nome_progetto")}`,
        `Data inizio: ${token("date", "data_inizio")}`,
        `Data fine: ${token("date", "data_fine")}`,
        "",
        "## Descrizione e Business Case",
        "Descrivere il problema o l'opportunita che motiva il progetto, includendo contesto, impatto atteso e stakeholder coinvolti.",
        "Motivare il business case con criteri utili a valutare priorita, urgenza e benefici per l'organizzazione.",
        `Descrizione progetto: ${token("text", "descrizione_progetto")}`,
        `Business case: ${token("text", "business_case")}`,
        `Benefici attesi: ${token("text", "benefici_attesi")}`,
        "",
        "## Obiettivi del progetto",
        "Definire risultati misurabili, criteri di accettazione e indicatori che sponsor e project manager useranno per valutare il successo.",
        "Indicare per ogni obiettivo il perimetro previsto, il valore atteso e le condizioni che rendono l'obiettivo verificabile.",
        `Obiettivi del progetto: ${token("text", "obiettivi_progetto")}`,
        "",
        "## Assunzioni",
        "Elencare le ipotesi operative considerate vere durante l'avvio del progetto e chiarire perche influenzano pianificazione e decisioni.",
        "Specificare assunzioni su risorse, disponibilita stakeholder, tecnologia o dipendenze esterne.",
        `Assunzioni principali: ${token("text", "assunzioni_principali")}`,
        "",
        "## Vincoli",
        "Indicare limiti di budget, calendario, ambito, compliance o tecnologia che il project manager deve rispettare.",
        "Chiarire quali vincoli sono negoziabili e quali richiedono escalation o approvazione formale.",
        `Vincoli principali: ${token("text", "vincoli_principali")}`,
        "",
        "## Rischi",
        "Descrivere i rischi iniziali, le cause probabili e l'impatto su tempi, costi, qualita o benefici attesi.",
        "Associare a ogni rischio criteri di priorita e azioni di mitigazione utili allo sponsor.",
        hasListExtended
          ? "{{list:livello_rischio:30:true:livelli_rischio,Alto,Medio,Basso}}"
          : token("string", "livello_rischio"),
        `Mitigazioni iniziali: ${token("text", "mitigazioni_iniziali")}`,
        "",
        "## Budget",
        "Riportare la stima economica iniziale e le principali categorie di costo da monitorare durante il progetto.",
        "Specificare criteri di controllo e soglie che richiedono approvazione dello sponsor.",
        `Budget stimato: ${token("currency", "budget_stimato", "integer")}`,
        `Note budget: ${token("text", "note_budget")}`,
        "",
        "## Criteri di successo",
        "Definire come verra valutato il successo del progetto in termini di risultato, qualita, adozione e valore di business.",
        "Usare criteri verificabili per evitare ambiguita durante approvazione e chiusura.",
        `Criteri di successo: ${token("text", "criteri_successo")}`,
        "",
        "## Autorita del Project Manager",
        "Descrivere poteri decisionali, autonomia operativa e limiti autorizzativi concessi al project manager.",
        "Chiarire quali decisioni possono essere prese direttamente e quali richiedono escalation allo sponsor.",
        `Autorita concessa: ${token("text", "autorita_project_manager")}`,
        "",
        "## Approvazioni finali",
        "Indicare ruoli e responsabilita delle persone che devono approvare il charter prima dell'avvio formale.",
        "Specificare condizioni di approvazione, eventuali note e data prevista per la firma.",
        `Sponsor approvatore: ${token("string", "sponsor_approvatore")}`,
        `Data approvazione: ${token("date", "data_approvazione")}`,
      );
    }

    if (include.healthcare) {
      lines.push(
        "## Contesto e ambito sanitario",
        "Descrivere il contesto operativo della struttura sanitaria e l'ambito di applicazione del documento.",
        "Specificare unita coinvolte, tipologia di servizio e confini organizzativi.",
        `Unita responsabile: ${token("string", "unita_responsabile")}`,
        `Ambito applicazione: ${token("text", "ambito_applicazione")}`,
        "",
        "## Ruoli e responsabilita",
        "Definire responsabilita operative di dottori, infermieri e personale sanitario.",
        "Chiarire catena decisionale, supervisione clinica e responsabilita di turno.",
        `Responsabile clinico: ${token("string", "responsabile_clinico")}`,
        `Responsabile infermieristico: ${token("string", "responsabile_infermieristico")}`,
        `Responsabilita operative: ${token("text", "responsabilita_operative")}`,
        "",
        "## Doveri e regole da seguire",
        "Elencare i doveri obbligatori e le regole operative da rispettare durante il servizio.",
        "Indicare criteri minimi di qualita, sicurezza e conformita.",
        `Doveri principali: ${token("text", "doveri_principali")}`,
        `Regole obbligatorie: ${token("text", "regole_obbligatorie")}`,
      );
      if (include.procedure || include.regulation) {
        lines.push(
          "",
          "## Procedure operative",
          "Descrivere procedure standard, passaggi operativi e modalita di tracciamento.",
          "Specificare quando attivare controlli aggiuntivi e verifiche di conformita.",
          `Procedure principali: ${token("text", "procedure_principali")}`,
          `Criteri verifica: ${token("text", "criteri_verifica")}`,
        );
      }
      if (include.emergency) {
        lines.push(
          "",
          "## Gestione emergenze",
          "Definire trigger di emergenza, ruoli di attivazione e flussi di escalation.",
          "Indicare canali di comunicazione e tempi di risposta attesi.",
          `Trigger emergenza: ${token("text", "trigger_emergenza")}`,
          `Procedure emergenza: ${token("text", "procedure_emergenza")}`,
          `Contatti escalation: ${token("string", "contatti_escalation")}`,
        );
      }
    }

    if (
      !include.contract &&
      !include.meeting &&
      !include.offer &&
      !include.customer &&
      !include.monthly &&
      !include.charter &&
      !include.healthcare
    ) {
      lines.push(
        `Titolo: ${token("string", "titolo_documento")}`,
        `Descrizione: ${token("text", "descrizione_documento")}`,
        `Data: ${token("date", "data_documento")}`,
      );
    }

    return {
      markdown: `${lines.join("\n")}\n`,
      model: "mock-template-draft-v1",
      latencyMs: Date.now() - started,
      options: {
        numPredict: null,
        temperature: null,
      },
    };
  }

  async analyzeTemplate(
    input: AiTemplateAuditInput,
  ): Promise<AiTemplateAuditResult> {
    const started = Date.now();
    const warnings: AiSemanticWarning[] = [];

    for (const field of input.fields) {
      const text = `${field.surroundingText} ${field.fullLine}`.trim();
      const match = RULES.find(
        (rule) =>
          rule.pattern.test(text) && rule.whenTypes.includes(field.currentType),
      );
      if (!match) continue;
      if (field.currentType === match.type) continue;
      if (!field.allowedTypes.includes(match.type)) continue;
      warnings.push({
        fieldName: field.fieldName,
        currentType: field.currentType,
        suggestedType: match.type,
        reason: `${match.reason} Contesto: "${field.surroundingText}"`,
        confidence: match.confidence,
        severity: "warning",
      });
    }

    return {
      warnings,
      model: "mock-semantic-rules-v1",
      latencyMs: Date.now() - started,
    };
  }
}
