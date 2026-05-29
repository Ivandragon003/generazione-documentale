export type SupportedDocumentType =
  | "project_charter"
  | "capitolato"
  | "verbale"
  | "project_plan"
  | "scheda"
  | "checklist"
  | "policy"
  | "procedure"
  | "report"
  | "requirements_document"
  | "generic_template";

export interface DocumentBlueprintRule {
  requiredSections: string[];
  recommendedTableSections: string[];
  contentDirectives?: string[];
  tableSchemas?: Record<string, string[]>;
  antiPatterns?: string[];
  referenceStandard?: string;
  detailLevel?: "compact" | "standard" | "extended" | "flexible";
  sectionGuidance?: string[];
  recommendedPlaceholders?: string[];
  profileExamples?: string[];
}

export interface DocumentArchetypeDefault {
  purpose: string;
  sections: string[];
  fields: string[];
}

export interface AuditSectionRule {
  label: string;
  aliases: string[];
  requiresTable?: boolean;
  requiredTableHeaders?: string[];
}

export const PROJECT_CHARTER_REQUIRED_SECTIONS: AuditSectionRule[] = [
  {
    label: "Titolo e informazioni generali del progetto",
    aliases: ["project charter", "informazioni generali", "dati progetto"],
  },
  { label: "Descrizione del progetto", aliases: ["descrizione del progetto"] },
  {
    label: "Business case o motivazione del progetto",
    aliases: ["business case", "motivazione del progetto"],
  },
  {
    label: "Obiettivi del progetto",
    aliases: ["obiettivi del progetto"],
    requiresTable: true,
    requiredTableHeaders: ["obiettivo", "descrizione", "metrica", "target"],
  },
  {
    label: "Benefici attesi",
    aliases: ["benefici attesi"],
    requiresTable: true,
    requiredTableHeaders: ["beneficio", "indicatore", "valore atteso"],
  },
  {
    label: "Ambito preliminare del progetto",
    aliases: ["ambito preliminare"],
    requiresTable: true,
    requiredTableHeaders: ["incluso", "escluso", "note"],
  },
  {
    label: "Deliverable principali",
    aliases: ["deliverable principali"],
    requiresTable: true,
  },
  {
    label: "Milestone principali",
    aliases: ["milestone principali"],
    requiresTable: true,
  },
  {
    label: "Stakeholder principali",
    aliases: ["stakeholder principali"],
    requiresTable: true,
  },
  {
    label: "Ruoli e responsabilita iniziali",
    aliases: ["ruoli e responsabilita iniziali", "ruoli e responsabilita"],
    requiresTable: true,
  },
  {
    label: "Requisiti di alto livello",
    aliases: ["requisiti di alto livello"],
    requiresTable: true,
  },
  { label: "Assunzioni", aliases: ["assunzioni"] },
  { label: "Vincoli", aliases: ["vincoli"] },
  {
    label: "Rischi iniziali",
    aliases: ["rischi iniziali", "rischi"],
    requiresTable: true,
    requiredTableHeaders: [
      "rischio",
      "descrizione",
      "probabilita",
      "impatto",
      "mitigazione",
    ],
  },
  {
    label: "Budget preliminare",
    aliases: ["budget preliminare", "budget"],
    requiresTable: true,
    requiredTableHeaders: ["voce di costo", "importo stimato", "note"],
  },
  { label: "Criteri di successo", aliases: ["criteri di successo"] },
  {
    label: "Autorita del project manager",
    aliases: ["autorita del project manager"],
    requiresTable: true,
    requiredTableHeaders: ["ambito decisionale", "limite", "note"],
  },
  {
    label: "Approvazioni finali",
    aliases: ["approvazioni finali"],
    requiresTable: true,
    requiredTableHeaders: ["nome", "ruolo", "data approvazione", "firma"],
  },
];

export const DOCUMENT_BLUEPRINTS: Partial<
  Record<SupportedDocumentType, DocumentBlueprintRule>
> = {
  project_charter: {
    referenceStandard: "PMBOK_PMI",
    detailLevel: "extended",
    requiredSections: [
      "Titolo e informazioni generali del progetto",
      "Descrizione del progetto",
      "Business case o motivazione del progetto",
      "Obiettivi del progetto",
      "Benefici attesi",
      "Ambito preliminare del progetto",
      "Deliverable principali",
      "Milestone principali",
      "Stakeholder principali",
      "Ruoli e responsabilita iniziali",
      "Requisiti di alto livello",
      "Assunzioni",
      "Vincoli",
      "Rischi iniziali",
      "Budget preliminare",
      "Criteri di successo",
      "Autorita del Project Manager",
      "Approvazioni finali",
    ],
    recommendedTableSections: [
      "Obiettivi del progetto",
      "Benefici attesi",
      "Ambito preliminare del progetto",
      "Deliverable principali",
      "Milestone principali",
      "Stakeholder principali",
      "Ruoli e responsabilita iniziali",
      "Requisiti di alto livello",
      "Rischi iniziali",
      "Budget preliminare",
      "Autorita del Project Manager",
      "Approvazioni finali",
    ],
    contentDirectives: [
      "Evitare titolo duplicato tra H1 e prima sezione.",
      "Usare # Project Charter come unico titolo principale.",
      "Distinguere obiettivi, benefici, ambito, deliverable, vincoli e rischi.",
      "Per sezioni tabellari introdurre motivo della tabella e criterio di compilazione.",
    ],
    sectionGuidance: [
      "Ogni sezione deve spiegare scopo, utilita decisionale e informazioni richieste.",
      "La guida deve essere comprensibile a sponsor, responsabili e stakeholder non tecnici.",
      "Il dettaglio deve aiutare approvazione, tracciabilita e avvio controllato dell'iniziativa.",
    ],
    recommendedPlaceholders: [
      "{{string:nome_progetto:120:true}}",
      "{{date:data_inizio:10:false}}",
      "{{string:sponsor_progetto:120:false}}",
      "{{text:descrizione_progetto:400:true}}",
      "{{string:obiettivo_1:160:true}}",
      "{{percentage:probabilita_1:5:false}}",
    ],
    profileExamples: [
      "| Obiettivo | Metrica | Target |",
      "| {{string:obiettivo_1:160:true}} | {{string:metrica_1:120:false}} | {{string:target_1:120:false}} |",
    ],
    tableSchemas: {
      "Obiettivi del progetto": [
        "Obiettivo",
        "Descrizione",
        "Metrica",
        "Target",
      ],
      "Benefici attesi": ["Beneficio", "Indicatore", "Valore atteso"],
      "Ambito preliminare del progetto": ["Incluso", "Escluso", "Note"],
      "Deliverable principali": [
        "Deliverable",
        "Descrizione",
        "Criterio di accettazione",
      ],
      "Milestone principali": [
        "Milestone",
        "Data prevista",
        "Risultato atteso",
      ],
      "Stakeholder principali": ["Stakeholder", "Ruolo", "Interesse"],
      "Ruoli e responsabilita iniziali": [
        "Ruolo",
        "Responsabilita",
        "Referente",
      ],
      "Requisiti di alto livello": ["Requisito", "Descrizione", "Priorita"],
      "Rischi iniziali": [
        "Rischio",
        "Descrizione",
        "Probabilità",
        "Impatto",
        "Mitigazione",
      ],
      "Budget preliminare": ["Voce di costo", "Importo stimato", "Note"],
      "Autorita del Project Manager": ["Ambito decisionale", "Limite", "Note"],
      "Approvazioni finali": [
        "Nome",
        "Ruolo",
        "Data approvazione",
        "Firma/Conferma",
      ],
    },
    antiPatterns: [
      "Non trasformare il charter in piano operativo di dettaglio.",
      "Non usare sezioni da verbale come ordine del giorno o prossima riunione.",
    ],
  },
  verbale: {
    detailLevel: "standard",
    requiredSections: [
      "Partecipanti",
      "Ordine del giorno",
      "Discussione",
      "Decisioni",
      "Action item",
      "Prossima riunione",
      "Approvazioni",
    ],
    recommendedTableSections: ["Partecipanti", "Action item", "Approvazioni"],
    contentDirectives: [
      "Rendere esplicite decisioni prese e motivazioni sintetiche.",
      "Per ogni action item includere responsabile e scadenza.",
    ],
    sectionGuidance: [
      "Distinguere contesto della riunione, discussione, decisioni e azioni.",
      "Mantenere descrizioni sintetiche e operative per chi deve eseguire o verificare.",
    ],
    recommendedPlaceholders: [
      "{{string:titolo_riunione:120:true}}",
      "{{date:data_riunione:10:true}}",
      "{{string:partecipante_1:120:false}}",
      "{{text:decisione_1:300:false}}",
      "{{string:responsabile_azione_1:120:false}}",
      "{{date:scadenza_azione_1:10:false}}",
    ],
    profileExamples: [
      "| Azione | Responsabile | Scadenza |",
      "| {{string:azione_1:160:true}} | {{string:responsabile_azione_1:120:false}} | {{date:scadenza_azione_1:10:false}} |",
    ],
    tableSchemas: {
      Partecipanti: ["Nome", "Ruolo", "Presenza"],
      "Action item": ["Azione", "Responsabile", "Scadenza", "Stato"],
      Approvazioni: ["Decisione", "Esito", "Responsabile"],
    },
    antiPatterns: [
      "Non inserire business case, budget preliminare o autorita del project manager se non richiesti.",
      "Non trasformare il verbale in policy o procedura normativa.",
    ],
  },
  report: {
    detailLevel: "standard",
    requiredSections: [
      "Periodo di riferimento",
      "KPI principali",
      "Ricavi",
      "Costi",
      "Margini",
      "Analisi scostamenti",
      "Rischi",
      "Conclusioni",
    ],
    recommendedTableSections: ["KPI principali", "Analisi scostamenti"],
    contentDirectives: [
      "Collegare KPI a periodo e fonte dati.",
      "Distinguere ricavi, costi, margini e scostamenti in modo misurabile.",
    ],
    sectionGuidance: [
      "Spiegare periodo, fonte dati e perimetro prima degli indicatori.",
      "Guidare dalla sintesi dei risultati alle cause degli scostamenti.",
    ],
    recommendedPlaceholders: [
      "{{string:periodo_riferimento:80:true}}",
      "{{currency:ricavi_totali:12:false}}",
      "{{currency:costi_totali:12:false}}",
      "{{percentage:margine_percentuale:5:false}}",
      "{{text:analisi_scostamenti:400:true}}",
    ],
    profileExamples: [
      "| KPI | Valore | Variazione |",
      "| {{string:kpi_1:120:true}} | {{number:valore_kpi_1:12:false}} | {{percentage:variazione_kpi_1:5:false}} |",
    ],
    tableSchemas: {
      "KPI principali": ["KPI", "Valore", "Target", "Variazione"],
      "Analisi scostamenti": ["Voce", "Scostamento", "Causa", "Azione"],
    },
    antiPatterns: [
      "Non inserire sezioni da Project Charter (business case, autorita del project manager, approvazioni finali PMBOK).",
      "Non inserire sezioni da verbale (ordine del giorno, action item, prossima riunione).",
    ],
  },
  scheda: {
    detailLevel: "compact",
    requiredSections: [
      "Dati polizza",
      "Contraente",
      "Coperture",
      "Massimali",
      "Esclusioni",
      "Premio",
      "Durata",
      "Beneficiario",
    ],
    recommendedTableSections: ["Coperture", "Massimali", "Esclusioni"],
    contentDirectives: [
      "Usare terminologia assicurativa chiara e spiegazioni brevi.",
      "Separare dati anagrafici, condizioni economiche, coperture, limiti ed esclusioni.",
    ],
    sectionGuidance: [
      "Chiarire cosa compilare e perche il dato e utile, senza testo lungo.",
      "Preferire tabelle compatte per confrontare coperture e massimali.",
    ],
    recommendedPlaceholders: [
      "{{string:numero_polizza:80:true}}",
      "{{string:nome_contraente:120:true}}",
      "{{currency:premio_annuo:12:false}}",
      "{{string:beneficiario_1:120:false}}",
      "{{date:data_decorrenza:10:false}}",
    ],
    profileExamples: [
      "| Copertura | Massimale | Limiti |",
      "| {{string:copertura_1:120:true}} | {{currency:massimale_1:12:false}} | {{string:limiti_1:160:false}} |",
    ],
    tableSchemas: {
      Coperture: ["Copertura", "Descrizione", "Limiti"],
      Massimali: ["Voce", "Massimale", "Note"],
      Esclusioni: ["Esclusione", "Descrizione", "Impatto"],
    },
    antiPatterns: [
      "Non inserire sezioni da Project Charter (business case, autorita del project manager, approvazioni finali PMBOK).",
      "Non inserire sezioni da verbale (ordine del giorno, action item, prossima riunione).",
    ],
  },
  checklist: {
    detailLevel: "compact",
    requiredSections: ["Scopo", "Voci di controllo", "Esito", "Note"],
    recommendedTableSections: ["Voci di controllo"],
    contentDirectives: [
      "Mantenere istruzioni brevi, verificabili e orientate all'esecuzione.",
      "Ogni voce deve indicare controllo, esito e responsabile quando utile.",
    ],
    sectionGuidance: [
      "Spiegare in poche righe quando usare la checklist e quale evidenza raccogliere.",
      "Formulare controlli osservabili, non descrizioni astratte.",
    ],
    recommendedPlaceholders: [
      "{{text:scopo_checklist:300:true}}",
      "{{string:area_controllo_1:120:false}}",
      "{{string:controllo_1:160:true}}",
      "{{string:esito_1:80:false}}",
    ],
    profileExamples: [
      "| Controllo | Esito | Note |",
      "| {{string:controllo_1:160:true}} | {{string:esito_1:80:false}} | {{string:note_1:160:false}} |",
    ],
    tableSchemas: {
      "Voci di controllo": [
        "Area",
        "Controllo",
        "Esito",
        "Note",
        "Responsabile",
      ],
    },
    antiPatterns: [
      "Non trasformare la checklist in piano progetto con milestone, stakeholder o business case.",
      "Non usare spiegazioni estese dove bastano controlli puntuali.",
    ],
  },
  capitolato: {
    detailLevel: "extended",
    requiredSections: [
      "Oggetto e contesto",
      "Ambito della fornitura",
      "Requisiti tecnici",
      "Criteri di accettazione",
    ],
    recommendedTableSections: ["Requisiti tecnici", "Criteri di accettazione"],
    contentDirectives: [
      "Descrivere oggetto, perimetro, requisiti e criteri di accettazione in modo verificabile.",
      "Distinguere requisiti obbligatori, preferenziali e vincoli di fornitura.",
    ],
    sectionGuidance: [
      "Ogni sezione deve chiarire cosa il fornitore deve comprendere, produrre o dimostrare.",
      "Usare linguaggio formale ma operativo, evitando formulazioni non misurabili.",
    ],
    recommendedPlaceholders: [
      "{{text:oggetto_fornitura:500:true}}",
      "{{text:ambito_fornitura:500:true}}",
      "{{string:requisito_tecnico_1:160:true}}",
      "{{string:priorita_requisito_1:80:false}}",
      "{{string:criterio_accettazione_1:160:true}}",
    ],
    profileExamples: [
      "| Requisito | Priorita | Criterio di verifica |",
      "| {{string:requisito_1:160:true}} | {{string:priorita_1:80:false}} | {{string:criterio_verifica_1:160:false}} |",
    ],
    tableSchemas: {
      "Requisiti tecnici": ["Requisito", "Priorita", "Criterio di verifica"],
      "Criteri di accettazione": ["Criterio", "Evidenza", "Responsabile"],
    },
    antiPatterns: [
      "Non inserire sezioni da verbale o Project Charter quando non richieste.",
      "Non usare obiettivi generici non collegati a requisiti verificabili.",
    ],
  },
  project_plan: {
    detailLevel: "extended",
    requiredSections: [
      "Obiettivi",
      "Attivita",
      "Responsabili",
      "Milestone",
      "Risorse",
      "Rischi",
      "KPI",
    ],
    recommendedTableSections: ["Attivita", "Milestone", "KPI"],
    contentDirectives: [
      "Collegare obiettivi, attivita, milestone e KPI.",
      "Associare responsabilita e risorse alle attivita principali.",
    ],
    sectionGuidance: [
      "Spiegare come obiettivi, attivita, risorse e milestone si collegano tra loro.",
      "Usare tabelle per pianificazione, responsabilita, KPI e rischi.",
    ],
    recommendedPlaceholders: [
      "{{text:obiettivi_piano:400:true}}",
      "{{string:attivita_1:160:true}}",
      "{{string:responsabile_attivita_1:120:false}}",
      "{{date:scadenza_attivita_1:10:false}}",
      "{{string:kpi_1:120:false}}",
    ],
    profileExamples: [
      "| Attivita | Responsabile | Scadenza | Stato |",
      "| {{string:attivita_1:160:true}} | {{string:responsabile_1:120:false}} | {{date:scadenza_1:10:false}} | {{string:stato_1:80:false}} |",
    ],
    tableSchemas: {
      Attivita: ["Attivita", "Responsabile", "Scadenza", "Stato"],
      Milestone: ["Milestone", "Data prevista", "Esito atteso"],
      KPI: ["KPI", "Metrica", "Target", "Valore attuale"],
    },
    antiPatterns: [
      "Non trasformare il piano in verbale di riunione.",
      "Non inserire condizioni assicurative o massimali se non richiesti.",
    ],
  },
  policy: {
    detailLevel: "extended",
    requiredSections: [
      "Scopo e ambito",
      "Ruoli e responsabilita",
      "Regole",
      "Controlli e conformita",
      "Eccezioni ed escalation",
    ],
    recommendedTableSections: [
      "Ruoli e responsabilita",
      "Controlli e conformita",
    ],
    contentDirectives: [
      "Chiarire perimetro, destinatari, regole obbligatorie e gestione eccezioni.",
      "Usare tono formale e indicazioni verificabili.",
    ],
    sectionGuidance: [
      "Spiegare perche la regola esiste, a chi si applica e come verificarne il rispetto.",
      "Distinguere responsabilita operative, controlli, eccezioni e canali di escalation.",
    ],
    recommendedPlaceholders: [
      "{{text:scopo_policy:400:true}}",
      "{{text:ambito_applicazione:400:true}}",
      "{{string:ruolo_1:120:false}}",
      "{{text:regola_principale_1:300:true}}",
      "{{string:controllo_1:160:false}}",
    ],
    profileExamples: [
      "| Ruolo | Responsabilita | Controllo |",
      "| {{string:ruolo_1:120:true}} | {{string:responsabilita_1:160:false}} | {{string:controllo_1:160:false}} |",
    ],
    tableSchemas: {
      "Ruoli e responsabilita": ["Ruolo", "Responsabilita", "Owner"],
      "Controlli e conformita": ["Controllo", "Frequenza", "Evidenza"],
    },
    antiPatterns: [
      "Non strutturare la policy come verbale o piano progetto.",
      "Non usare linguaggio opzionale per regole obbligatorie.",
    ],
  },
  procedure: {
    detailLevel: "standard",
    requiredSections: [
      "Scopo e contesto",
      "Ruoli coinvolti",
      "Passaggi operativi",
      "Controlli",
      "Gestione eccezioni",
    ],
    recommendedTableSections: ["Passaggi operativi", "Controlli"],
    contentDirectives: [
      "Descrivere sequenza, responsabilita, input, output e controlli.",
      "Mantenere istruzioni operative chiare e verificabili.",
    ],
    sectionGuidance: [
      "Guidare l'utente passo per passo, indicando cosa fare, chi interviene e quale evidenza produrre.",
      "Separare flusso ordinario, controlli e gestione delle eccezioni.",
    ],
    recommendedPlaceholders: [
      "{{text:scopo_procedura:400:true}}",
      "{{string:ruolo_responsabile:120:false}}",
      "{{string:passaggio_1:160:true}}",
      "{{string:controllo_1:160:false}}",
      "{{text:gestione_eccezioni:400:false}}",
    ],
    profileExamples: [
      "| Passaggio | Responsabile | Output |",
      "| {{string:passaggio_1:160:true}} | {{string:responsabile_1:120:false}} | {{string:output_1:160:false}} |",
    ],
    tableSchemas: {
      "Passaggi operativi": ["Passaggio", "Responsabile", "Output"],
      Controlli: ["Controllo", "Responsabile", "Evidenza"],
    },
    antiPatterns: [
      "Non trasformare la procedura in policy astratta senza passaggi operativi.",
      "Non inserire sezioni economiche o assicurative se non richieste.",
    ],
  },
  requirements_document: {
    detailLevel: "extended",
    requiredSections: [
      "Scopo e ambito",
      "Requisiti di alto livello",
      "Requisiti funzionali",
      "Vincoli",
      "Dipendenze",
      "Criteri di accettazione",
    ],
    recommendedTableSections: [
      "Requisiti funzionali",
      "Dipendenze",
      "Criteri di accettazione",
    ],
    contentDirectives: [
      "Distinguere requisiti, vincoli, dipendenze e criteri di accettazione.",
      "Rendere ogni requisito verificabile e tracciabile.",
    ],
    sectionGuidance: [
      "Spiegare scopo del requisito, valore atteso e modo di verifica.",
      "Usare tabelle per priorita, stato, dipendenze e criteri di accettazione.",
    ],
    recommendedPlaceholders: [
      "{{text:scopo_documento:400:true}}",
      "{{string:requisito_1:160:true}}",
      "{{string:priorita_requisito_1:80:false}}",
      "{{string:criterio_accettazione_1:160:true}}",
      "{{string:dipendenza_1:160:false}}",
    ],
    profileExamples: [
      "| Requisito | Priorita | Criterio di accettazione |",
      "| {{string:requisito_1:160:true}} | {{string:priorita_1:80:false}} | {{string:criterio_accettazione_1:160:true}} |",
    ],
    tableSchemas: {
      "Requisiti funzionali": ["Requisito", "Priorita", "Stato"],
      Dipendenze: ["Dipendenza", "Impatto", "Owner"],
      "Criteri di accettazione": ["Criterio", "Evidenza", "Esito atteso"],
    },
    antiPatterns: [
      "Non usare sezioni da verbale o policy quando non richieste.",
      "Non descrivere requisiti non verificabili o privi di criterio di accettazione.",
    ],
  },
  generic_template: {
    detailLevel: "flexible",
    requiredSections: [],
    recommendedTableSections: [],
    contentDirectives: [
      "Mantenere struttura professionale coerente con la richiesta utente, senza importare sezioni specialistiche non richieste.",
      "Se l'utente indica un dominio specifico, derivare sezioni operative concrete dal dominio invece di usare sezioni generiche.",
      "Usare tabelle Markdown per dati ripetibili come elenchi di clienti, scadenze, pagamenti, iscritti.",
      "Diversificare i tipi di placeholder: non usare solo text per tutto il documento.",
    ],
    sectionGuidance: [
      "Derivare sezioni, profondita e tabelle dalla richiesta utente e dal dominio indicato.",
      "Usare spiegazioni discorsive chiare ma non imporre schemi specialistici.",
      "Evitare sezioni generiche come Contesto, Obiettivi, Contenuto principale quando il dominio e chiaro.",
    ],
    recommendedPlaceholders: [
      "{{text:contesto_documento:400:true}}",
      "{{string:elemento_1:120:false}}",
      "{{date:data_riferimento:10:false}}",
    ],
    profileExamples: [
      "Elemento principale: {{string:elemento_1:120:false}}",
      "Scadenza: {{date:scadenza_1:10:true}}",
    ],
    antiPatterns: [
      "Non importare sezioni specialistiche da profili non attivi (business case, milestone principali, stakeholder principali, autorita del project manager, approvazioni finali, ordine del giorno, action item, prossima riunione, capitolato).",
      "Non usare standard o terminologia di dominio non richiesti dall'utente.",
      "Non generare sezioni generiche (Contesto, Obiettivi, Contenuto principale) quando l'utente indica un dominio specifico.",
    ],
  },
};
export const DOCUMENT_ARCHETYPE_DEFAULTS: Record<
  SupportedDocumentType,
  DocumentArchetypeDefault
> = {
  project_charter: {
    purpose: "project_charter",
    sections: PROJECT_CHARTER_REQUIRED_SECTIONS.map((section) => section.label),
    fields: [
      "nome_progetto",
      "descrizione_progetto",
      "business_case",
      "obiettivi_progetto",
      "benefici_attesi",
      "ambito_preliminare",
      "deliverable_1",
      "data_milestone_1",
      "stakeholder_1",
      "responsabilita_ruolo_1",
      "requisito_1",
      "assunzioni_principali",
      "vincoli_principali",
      "rischio_1",
      "budget_preliminare",
      "criteri_successo",
      "autorita_project_manager",
      "nome_approvatore_1",
    ],
  },
  capitolato: {
    purpose: "technical_specification",
    sections: [
      "Oggetto e contesto",
      "Ambito della fornitura",
      "Requisiti tecnici",
      "Requisiti di conformita",
      "Criteri di accettazione",
      "Tempi di consegna",
      "Penali e SLA",
    ],
    fields: [
      "oggetto_fornitura",
      "ambito_fornitura",
      "requisito_tecnico_1",
      "requisito_conformita_1",
      "criterio_accettazione_1",
      "data_consegna_prevista",
      "sla_principale",
    ],
  },
  verbale: {
    purpose: "meeting_minutes",
    sections: [
      "Informazioni riunione",
      "Partecipanti",
      "Ordine del giorno",
      "Discussione",
      "Decisioni prese",
      "Azioni e responsabili",
      "Action item",
      "Prossimi passi",
      "Prossima riunione",
      "Approvazioni",
    ],
    fields: [
      "titolo_riunione",
      "data_riunione",
      "partecipante_1",
      "punto_odg_1",
      "decisione_1",
      "azione_1",
    ],
  },
  project_plan: {
    purpose: "project_plan",
    sections: [
      "Contesto e obiettivi",
      "Ambito e deliverable",
      "Pianificazione temporale",
      "Risorse e responsabilita",
      "Rischi e mitigazioni",
      "Comunicazione e governance",
    ],
    fields: [
      "contesto_progetto",
      "obiettivi_progetto",
      "deliverable_1",
      "milestone_1",
      "ruolo_1",
      "rischio_1",
    ],
  },
  scheda: {
    purpose: "insurance_sheet",
    sections: [
      "Dati polizza",
      "Contraente",
      "Coperture",
      "Massimali",
      "Esclusioni",
      "Premio",
      "Durata",
      "Beneficiario",
      "Note operative",
    ],
    fields: [
      "numero_polizza",
      "nome_contraente",
      "copertura_1",
      "massimale_1",
      "esclusione_1",
      "premio_annuo",
      "durata_polizza",
      "beneficiario_1",
      "note_operative",
    ],
  },
  checklist: {
    purpose: "operational_checklist",
    sections: ["Scopo", "Voci di controllo", "Esito", "Note"],
    fields: [
      "scopo_checklist",
      "voce_controllo_1",
      "esito_controllo_1",
      "note_checklist",
    ],
  },
  policy: {
    purpose: "policy_document",
    sections: [
      "Scopo e ambito",
      "Ruoli e responsabilita",
      "Regole e policy",
      "Controlli e conformita",
      "Eccezioni ed escalation",
    ],
    fields: [
      "scopo_documento",
      "ambito_applicazione",
      "ruoli_coinvolti",
      "regole_principali",
      "criteri_conformita",
    ],
  },
  procedure: {
    purpose: "operating_procedure",
    sections: [
      "Scopo e contesto",
      "Ruoli coinvolti",
      "Passaggi operativi",
      "Controlli",
      "Gestione eccezioni",
    ],
    fields: [
      "scopo_procedura",
      "ruolo_responsabile",
      "passaggio_1",
      "controllo_1",
      "gestione_eccezioni",
    ],
  },
  report: {
    purpose: "status_report",
    sections: [
      "Contesto",
      "Sintesi esecutiva",
      "Dati e risultati",
      "Analisi",
      "Azioni raccomandate",
    ],
    fields: [
      "contesto_report",
      "sintesi_esecutiva",
      "dati_principali",
      "analisi_risultati",
      "azioni_raccomandate",
    ],
  },
  requirements_document: {
    purpose: "requirements_document",
    sections: [
      "Scopo e ambito",
      "Requisiti di alto livello",
      "Vincoli",
      "Dipendenze",
      "Criteri di accettazione",
    ],
    fields: [
      "scopo_documento",
      "requisiti_alto_livello",
      "vincoli_principali",
      "dipendenze_principali",
      "criteri_accettazione",
    ],
  },
  generic_template: {
    purpose: "structured_document",
    sections: [],
    fields: [],
  },
};

export const AUDIT_DOCUMENT_REQUIRED_PROFILES: Partial<
  Record<SupportedDocumentType, { sections: AuditSectionRule[] }>
> = {
  project_charter: { sections: PROJECT_CHARTER_REQUIRED_SECTIONS },
  verbale: {
    sections: [
      { label: "Partecipanti", aliases: ["partecipanti"], requiresTable: true },
      { label: "Ordine del giorno", aliases: ["ordine del giorno"] },
      { label: "Discussione", aliases: ["discussione"] },
      { label: "Decisioni", aliases: ["decisioni"] },
      {
        label: "Action item",
        aliases: ["action item", "azioni", "azioni e responsabili"],
        requiresTable: true,
      },
      { label: "Prossima riunione", aliases: ["prossima riunione"] },
      { label: "Approvazioni", aliases: ["approvazioni"], requiresTable: true },
    ],
  },
  report: {
    sections: [
      { label: "Periodo di riferimento", aliases: ["periodo"] },
      { label: "KPI principali", aliases: ["kpi"], requiresTable: true },
      { label: "Ricavi", aliases: ["ricavi"] },
      { label: "Costi", aliases: ["costi"] },
      { label: "Margini", aliases: ["margini"] },
      {
        label: "Analisi scostamenti",
        aliases: ["analisi scostamenti", "scostamenti"],
      },
      { label: "Rischi", aliases: ["rischi"] },
      { label: "Conclusioni", aliases: ["conclusioni"] },
    ],
  },
  scheda: {
    sections: [
      { label: "Dati polizza", aliases: ["dati polizza", "polizza"] },
      { label: "Contraente", aliases: ["contraente"] },
      { label: "Coperture", aliases: ["coperture"] },
      { label: "Massimali", aliases: ["massimali"] },
      { label: "Esclusioni", aliases: ["esclusioni"] },
      { label: "Premio", aliases: ["premio"] },
      { label: "Durata", aliases: ["durata"] },
      { label: "Beneficiario", aliases: ["beneficiario"] },
    ],
  },
  capitolato: {
    sections: [
      { label: "Oggetto e contesto", aliases: ["oggetto", "contesto"] },
      {
        label: "Ambito della fornitura",
        aliases: ["ambito della fornitura", "ambito"],
      },
      {
        label: "Requisiti tecnici",
        aliases: ["requisiti tecnici"],
        requiresTable: true,
      },
      {
        label: "Criteri di accettazione",
        aliases: ["criteri di accettazione"],
      },
    ],
  },
  project_plan: {
    sections: [
      { label: "Obiettivi", aliases: ["obiettivi"] },
      { label: "Attivita", aliases: ["attivita"], requiresTable: true },
      { label: "Responsabili", aliases: ["responsabili"] },
      { label: "Milestone", aliases: ["milestone"], requiresTable: true },
      { label: "Risorse", aliases: ["risorse"] },
      { label: "Rischi", aliases: ["rischi"] },
      { label: "KPI", aliases: ["kpi"], requiresTable: true },
    ],
  },
  checklist: {
    sections: [
      { label: "Scopo", aliases: ["scopo"] },
      {
        label: "Voci di controllo",
        aliases: ["voci di controllo", "checklist"],
        requiresTable: true,
      },
      { label: "Esito", aliases: ["esito"] },
    ],
  },
};
