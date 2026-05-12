# Verbale di Riunione Tecnica

**Progetto:** {{progetto}}  
**Data:** {{data_riunione}}  
**Orario:** {{ora_inizio}} – {{ora_fine}}  
**Luogo / Piattaforma:** {{luogo}}  
**Verbalizzatore:** {{verbalizzatore}}

---

## 1. Partecipanti

| Nome                    | Ruolo                    | Azienda                    | Presenza                |
| ----------------------- | ------------------------ | -------------------------- | ----------------------- |
| {{partecipante_1_nome}} | {{partecipante_1_ruolo}} | {{partecipante_1_azienda}} | ✅ Presente             |
| {{partecipante_2_nome}} | {{partecipante_2_ruolo}} | {{partecipante_2_azienda}} | ✅ Presente             |
| {{partecipante_3_nome}} | {{partecipante_3_ruolo}} | {{partecipante_3_azienda}} | ✅ Presente             |
| {{partecipante_4_nome}} | {{partecipante_4_ruolo}} | {{partecipante_4_azienda}} | ⬜ Assente giustificato |

---

## 2. Ordine del Giorno

| #   | Punto                                             | Durata stimata | Relatore                |
| --- | ------------------------------------------------- | -------------- | ----------------------- |
| 1   | Revisione stato avanzamento lavori (SAL)          | 20 min         | {{verbalizzatore}}      |
| 2   | Analisi criticità emerse nell'ultimo sprint       | 15 min         | {{partecipante_1_nome}} |
| 3   | Revisione architettura modulo {{modulo_discusso}} | 25 min         | {{partecipante_2_nome}} |
| 4   | Pianificazione prossimo sprint                    | 20 min         | {{verbalizzatore}}      |
| 5   | Varie ed eventuali                                | 10 min         | Tutti                   |

---

## 3. Stato Avanzamento Lavori

### 3.1 Avanzamento per modulo

| Modulo                 | Stato          | % Completamento     | Note                   |
| ---------------------- | -------------- | ------------------- | ---------------------- |
| Autenticazione e RBAC  | ✅ Completato  | 100%                | In produzione          |
| Gestione template      | 🔄 In corso    | {{perc_template}}%  | {{note_template}}      |
| Generazione documenti  | 🔄 In corso    | {{perc_documenti}}% | {{note_documenti}}     |
| Export PDF             | ⏳ Da iniziare | 0%                  | Bloccato su dipendenza |
| Dashboard reportistica | ⏳ Da iniziare | 0%                  | Sprint successivo      |
| API pubblica (v2)      | 🔄 In corso    | {{perc_api}}%       | {{note_api}}           |

### 3.2 Metriche sprint corrente

| Metrica                   | Valore               | Target        | Stato              |
| ------------------------- | -------------------- | ------------- | ------------------ |
| Story points completati   | {{sp_completati}}    | {{sp_target}} | {{stato_sp}}       |
| Bug aperti                | {{bug_aperti}}       | < 5           | {{stato_bug}}      |
| Bug chiusi nello sprint   | {{bug_chiusi}}       | —             | —                  |
| Copertura test (coverage) | {{coverage}}%        | > 80%         | {{stato_coverage}} |
| Tempo medio PR review     | {{tempo_review}} ore | < 24h         | {{stato_review}}   |

---

## 4. Criticità e Blocchi

| #    | Criticità            | Impatto  | Responsabile          | Scadenza risoluzione     |
| ---- | -------------------- | -------- | --------------------- | ------------------------ |
| C-01 | {{criticita_1_desc}} | 🔴 Alto  | {{criticita_1_owner}} | {{criticita_1_scadenza}} |
| C-02 | {{criticita_2_desc}} | 🟡 Medio | {{criticita_2_owner}} | {{criticita_2_scadenza}} |
| C-03 | {{criticita_3_desc}} | 🟢 Basso | {{criticita_3_owner}} | {{criticita_3_scadenza}} |

---

## 5. Decisioni Prese

| #    | Decisione       | Motivazione       | Approvato da      |
| ---- | --------------- | ----------------- | ----------------- |
| D-01 | {{decisione_1}} | {{motivazione_1}} | Unanimità         |
| D-02 | {{decisione_2}} | {{motivazione_2}} | Maggioranza       |
| D-03 | {{decisione_3}} | {{motivazione_3}} | {{approvatore_3}} |

---

## 6. Action Items

| ID    | Azione       | Responsabile | Priorità | Scadenza       | Stato     |
| ----- | ------------ | ------------ | -------- | -------------- | --------- |
| AI-01 | {{azione_1}} | {{owner_1}}  | 🔴 Alta  | {{scadenza_1}} | ⏳ Aperto |
| AI-02 | {{azione_2}} | {{owner_2}}  | 🔴 Alta  | {{scadenza_2}} | ⏳ Aperto |
| AI-03 | {{azione_3}} | {{owner_3}}  | 🟡 Media | {{scadenza_3}} | ⏳ Aperto |
| AI-04 | {{azione_4}} | {{owner_4}}  | 🟡 Media | {{scadenza_4}} | ⏳ Aperto |
| AI-05 | {{azione_5}} | {{owner_5}}  | 🟢 Bassa | {{scadenza_5}} | ⏳ Aperto |

---

## 7. Pianificazione Prossimo Sprint

| Sprint                                | Date                                                    | Obiettivo principale          | Capacità (pt)                |
| ------------------------------------- | ------------------------------------------------------- | ----------------------------- | ---------------------------- |
| Sprint {{sprint_corrente}} (corrente) | {{data_inizio_sprint}} – {{data_fine_sprint}}           | {{obiettivo_sprint_corrente}} | {{capacita_sprint_corrente}} |
| Sprint {{sprint_prossimo}} (prossimo) | {{data_inizio_sprint_next}} – {{data_fine_sprint_next}} | {{obiettivo_sprint_prossimo}} | {{capacita_sprint_prossimo}} |

### Backlog prioritizzato per prossimo sprint

| ID             | User Story    | Stima (pt)  | Assegnatario   |
| -------------- | ------------- | ----------- | -------------- |
| US-{{us_1_id}} | {{us_1_desc}} | {{us_1_pt}} | {{us_1_owner}} |
| US-{{us_2_id}} | {{us_2_desc}} | {{us_2_pt}} | {{us_2_owner}} |
| US-{{us_3_id}} | {{us_3_desc}} | {{us_3_pt}} | {{us_3_owner}} |
| US-{{us_4_id}} | {{us_4_desc}} | {{us_4_pt}} | {{us_4_owner}} |

---

## 8. Prossima Riunione

**Data:** {{prossima_riunione}}  
**Piattaforma:** {{luogo}}  
**Agenda preliminare:** Revisione action items + SAL sprint {{sprint_prossimo}}

---

_Verbale redatto da {{verbalizzatore}} — Approvato dai partecipanti salvo osservazioni entro 48h_
