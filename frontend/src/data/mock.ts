export type TemplateField = {
  key: string;
  label: string;
  type: 'text' | 'longText' | 'currency' | 'date';
  placeholder: string;
};

export type TemplateVersion = {
  id: string;
  version: string;
  markdown: string;
  fields: TemplateField[];
};

export const initialTemplate: TemplateVersion = {
  id: 'tpl-project-charter-v1',
  version: '1.0',
  markdown: `# Documento di Avvio del Progetto (Project Charter)\n\n## 1. Titolo del Progetto\n**Titolo:** {{titoloProgetto}}\n\n---\n\n## 2. Scopo o Giustificazione del Progetto\n{{scopoProgetto}}\n\n---\n\n## 3. Obiettivi Misurabili e Criteri di Successo\n{{obiettiviProgetto}}\n\n---\n\n## 4. Budget Stimato\n**Budget:** {{budgetStimato}}\n\n## 5. Timeline\n**Timeline:** {{timeline}}\n\n## 6. Stakeholder Principali\n{{stakeholderPrincipali}}`,
  fields: [
    { key: 'titoloProgetto', label: 'Titolo del Progetto', type: 'text', placeholder: 'Es. Sistema Gestione Documentale v2.0' },
    { key: 'scopoProgetto', label: 'Scopo o Giustificazione', type: 'longText', placeholder: 'Contesto organizzativo...' },
    { key: 'obiettiviProgetto', label: 'Obiettivi e Criteri di Successo', type: 'longText', placeholder: 'Obiettivi in forma misurabile...' },
    { key: 'budgetStimato', label: 'Budget Stimato', type: 'currency', placeholder: 'Es. € 150.000' },
    { key: 'timeline', label: 'Timeline', type: 'text', placeholder: 'Es. Q2–Q4 2026' },
    { key: 'stakeholderPrincipali', label: 'Stakeholder Principali', type: 'longText', placeholder: 'Sponsor, PM, referenti...' }
  ]
};

export const initialFieldValues: Record<string, string> = {
  titoloProgetto: 'Sistema Gestione Documentale v2.0',
  scopoProgetto: 'Digitalizzare il flusso di creazione, validazione e generazione PDF dei documenti di governance.',
  obiettiviProgetto: 'Ridurre i tempi di compilazione del 40%, garantire auditabilità dei template e centralizzare le versioni.',
  budgetStimato: '€ 150.000',
  timeline: 'Q2–Q4 2026',
  stakeholderPrincipali: 'Direzione IT, PMO, Compliance, team sviluppo backend e frontend.'
};
