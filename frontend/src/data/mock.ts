export type TemplateField = {
  key: string;
  label: string;
  type: "text" | "longText" | "currency" | "date";
  placeholder: string;
};

export const initialTemplate = {
  id: "tpl-project-charter-v1",
  version: "1.0",
  markdown: `# Documento di Avvio del Progetto (Project Charter)\n\n## 1. Titolo del Progetto\n**Titolo:** {{titoloProgetto}}\n\n---\n\n## 2. Scopo o Giustificazione del Progetto\n{{scopoProgetto}}\n\n---\n\n## 3. Obiettivi Misurabili e Criteri di Successo\n{{obiettiviProgetto}}\n\n---\n\n## 4. Budget Stimato\n**Budget:** {{budgetStimato}}\n\n## 5. Timeline\n**Timeline:** {{timeline}}\n\n## 6. Stakeholder Principali\n{{stakeholderPrincipali}}`,
  fields: [
    {
      key: "titoloProgetto",
      label: "Titolo del Progetto",
      type: "text" as const,
      placeholder: "Es. Sistema Gestione Documentale v2.0",
    },
    {
      key: "scopoProgetto",
      label: "Scopo o Giustificazione",
      type: "longText" as const,
      placeholder: "Contesto organizzativo...",
    },
    {
      key: "obiettiviProgetto",
      label: "Obiettivi e Criteri di Successo",
      type: "longText" as const,
      placeholder: "Obiettivi in forma misurabile...",
    },
    {
      key: "budgetStimato",
      label: "Budget Stimato",
      type: "currency" as const,
      placeholder: "Es. \u20ac 150.000",
    },
    {
      key: "timeline",
      label: "Timeline",
      type: "text" as const,
      placeholder: "Es. Q2\u2013Q4 2026",
    },
    {
      key: "stakeholderPrincipali",
      label: "Stakeholder Principali",
      type: "longText" as const,
      placeholder: "Sponsor, PM, referenti...",
    },
  ],
};
