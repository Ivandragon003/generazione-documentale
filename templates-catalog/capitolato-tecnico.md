# Capitolato Tecnico d'Appalto

**Ente Appaltante:** {{ente_appaltante}}  
**Codice Gara:** {{codice_gara}}  
**Data pubblicazione:** {{data_pubblicazione}}

---

## 1. Informazioni Generali

| Campo                          | Dettaglio                              |
| ------------------------------ | -------------------------------------- |
| Oggetto dell'appalto           | {{oggetto_appalto}}                    |
| Importo a base d'asta          | € {{importo_base}} (IVA esclusa)       |
| Durata contratto               | {{durata_contratto}} mesi              |
| Luogo di esecuzione            | {{luogo_esecuzione}}                   |
| Responsabile del Procedimento  | {{responsabile_procedimento}}          |
| Scadenza presentazione offerte | {{data_scadenza}} ore 12:00            |
| Criterio di aggiudicazione     | Offerta economicamente più vantaggiosa |

---

## 2. Requisiti Tecnici Obbligatori

### 2.1 Requisiti di sistema

| ID    | Requisito                                       | Obbligatorio | Verificabile                  |
| ----- | ----------------------------------------------- | ------------ | ----------------------------- |
| RT-01 | Architettura microservizi o a moduli            | ✅ Sì        | Documentazione architetturale |
| RT-02 | API RESTful con documentazione OpenAPI 3.0      | ✅ Sì        | Swagger UI accessibile        |
| RT-03 | Autenticazione OAuth2 / JWT                     | ✅ Sì        | Test di penetrazione          |
| RT-04 | Database relazionale PostgreSQL ≥ 14            | ✅ Sì        | Script di migrazione          |
| RT-05 | Backup automatico giornaliero                   | ✅ Sì        | Log di backup                 |
| RT-06 | Supporto multi-tenant                           | ✅ Sì        | Demo funzionale               |
| RT-07 | Interfaccia responsive (mobile-first)           | ✅ Sì        | Test su dispositivi           |
| RT-08 | Compatibilità browser (Chrome, Firefox, Edge)   | ✅ Sì        | Report test                   |
| RT-09 | Esportazione dati in formato aperto (CSV, JSON) | ✅ Sì        | Demo funzionale               |
| RT-10 | Log applicativo centralizzato                   | ✅ Sì        | Accesso ai log                |

### 2.2 Requisiti di sicurezza

| ID    | Requisito                             | Standard di riferimento |
| ----- | ------------------------------------- | ----------------------- |
| RS-01 | Cifratura dati in transito (TLS 1.2+) | OWASP TOP 10            |
| RS-02 | Cifratura dati sensibili a riposo     | GDPR Art. 32            |
| RS-03 | Gestione ruoli e permessi (RBAC)      | ISO 27001               |
| RS-04 | Audit log delle operazioni critiche   | GDPR Art. 30            |
| RS-05 | Vulnerability Assessment semestrale   | OWASP ASVS              |

---

## 3. Criteri di Valutazione

### 3.1 Punteggi tecnici (max 70 punti)

| Criterio                               | Peso  | Metodo di valutazione         |
| -------------------------------------- | ----- | ----------------------------- |
| Qualità architetturale della soluzione | 20 pt | Valutazione elaborato tecnico |
| Esperienza del team (anni e referenze) | 15 pt | CV e referenze                |
| Piano di progetto e cronoprogramma     | 10 pt | Dettaglio e realismo          |
| Soluzioni innovative proposte          | 10 pt | Valutazione commissione       |
| Piano di formazione utenti             | 8 pt  | Programma formativo           |
| SLA proposti (superiori al minimo)     | 7 pt  | Confronto con baseline        |

### 3.2 Punteggio economico (max 30 punti)

| Formula                               | Descrizione                         |
| ------------------------------------- | ----------------------------------- |
| P = 30 × (Offerta_minima / Offerta_i) | Proporzionale all'offerta più bassa |

---

## 4. Cronoprogramma

| Fase       | Descrizione                  | Durata           | Milestone                   |
| ---------- | ---------------------------- | ---------------- | --------------------------- |
| 1          | Analisi requisiti e kick-off | 4 settimane      | Piano di progetto approvato |
| 2          | Progettazione architetturale | 3 settimane      | Documento di architettura   |
| 3          | Sviluppo moduli core         | 12 settimane     | Demo funzionale             |
| 4          | Sviluppo moduli secondari    | 8 settimane      | Sistema completo in staging |
| 5          | Test di sistema e UAT        | 4 settimane      | Verbale di collaudo         |
| 6          | Formazione utenti            | 2 settimane      | Attestati di formazione     |
| 7          | Go-live e affiancamento      | 2 settimane      | Messa in produzione         |
| **Totale** |                              | **35 settimane** |                             |

---

## 5. Documentazione Richiesta in Offerta

| #   | Documento                            | Formato            | Obbligatorio |
| --- | ------------------------------------ | ------------------ | ------------ |
| 1   | Elaborato tecnico descrittivo        | PDF, max 30 pag.   | ✅           |
| 2   | Architettura della soluzione         | PDF + diagrammi    | ✅           |
| 3   | CV dei componenti del team           | PDF                | ✅           |
| 4   | Referenze progetti analoghi (min. 3) | PDF                | ✅           |
| 5   | Cronoprogramma dettagliato           | PDF / Gantt        | ✅           |
| 6   | Piano di formazione                  | PDF                | ✅           |
| 7   | Piano di sicurezza                   | PDF                | ✅           |
| 8   | Offerta economica                    | Modello allegato A | ✅           |

---

## 6. Penali Contrattuali

| Inadempienza                    | Penale giornaliera             | Massimale   |
| ------------------------------- | ------------------------------ | ----------- |
| Ritardo consegna milestone      | 0,5‰ dell'importo contrattuale | 10% importo |
| Mancato rispetto SLA critico    | € 500 per evento               | 5% importo  |
| Indisponibilità sistema > 4h    | € 1.000 per evento             | 5% importo  |
| Violazione sicurezza imputabile | € 5.000 per evento             | 20% importo |

---

_Capitolato redatto da {{responsabile_procedimento}} — {{ente_appaltante}}_
