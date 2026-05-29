export type SupportedDomain =
  | "project_management"
  | "assicurativo"
  | "economico"
  | "tecnico"
  | "amministrativo"
  | "commerciale"
  | "organizzativo"
  | "generico";

export interface DomainProfileRule {
  semanticRules: string[];
  recommendedTerms?: string[];
  suggestedSections?: string[];
  suggestedFields?: string[];
}

export const DOMAIN_PROFILES: Partial<
  Record<SupportedDomain, DomainProfileRule>
> = {
  project_management: {
    semanticRules: [
      "allineare obiettivi, deliverable, milestone, rischi e governance",
      "evitare ambiguita su ruoli, responsabilita e criteri di successo",
    ],
    recommendedTerms: [
      "avanzamento progetto",
      "approvazione formale",
      "ambito preliminare",
    ],
  },
  assicurativo: {
    semanticRules: [
      "includere coperture, massimali, esclusioni, premio e durata",
      "usare formulazioni chiare su condizioni e limiti",
    ],
    recommendedTerms: ["polizza", "sinistro", "premio", "massimale", "rinnovo"],
    suggestedSections: [
      "Clienti",
      "Polizze",
      "Scadenze e rinnovi",
      "Sinistri",
      "Premi e pagamenti",
      "Documenti richiesti",
      "Compagnie assicurative",
      "Comunicazioni con il cliente",
      "Stato delle pratiche",
    ],
  },
  economico: {
    semanticRules: [
      "esplicitare periodo, KPI, ricavi, costi, margini e scostamenti",
      "mantenere coerenza tra metriche e valori economici",
    ],
  },
  tecnico: {
    semanticRules: [
      "definire requisiti, vincoli tecnici, criteri di accettazione e tracciabilita",
    ],
  },
  amministrativo: {
    semanticRules: [
      "esplicitare responsabilita, riferimenti formali e stati approvativi",
    ],
  },
  commerciale: {
    semanticRules: [
      "chiarire oggetto, condizioni, validita e criteri economici/contrattuali",
    ],
    suggestedSections: [
      "Iscritti",
      "Abbonamenti",
      "Scadenze iscrizioni",
      "Pagamenti",
      "Istruttori",
      "Classi e orari",
      "Servizi offerti",
      "Storico pratiche",
    ],
  },
  organizzativo: {
    semanticRules: [
      "esplicitare ruoli, coordinamento, tempi e dipendenze operative",
    ],
  },
  generico: {
    semanticRules: ["mantenere struttura coerente con scopo e pubblico utente"],
  },
};
