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

| ID    | Requisito                                       | Obbligatorio |
| ----- | ----------------------------------------------- | ------------ |
| RT-01 | Architettura microservizi o a moduli            | ✅ Sì        |
| RT-02 | API RESTful con documentazione OpenAPI 3.0      | ✅ Sì        |
| RT-03 | Autenticazione OAuth2 / JWT                     | ✅ Sì        |
| RT-04 | Database relazionale PostgreSQL ≥ 14            | ✅ Sì        |
| RT-05 | Backup automatico giornaliero                   | ✅ Sì        |

---

## 3. Penali Contrattuali

| Inadempienza                    | Penale giornaliera             | Massimale   |
| ------------------------------- | ------------------------------ | ----------- |
| Ritardo consegna milestone      | 0,5‰ dell'importo contrattuale | 10% importo |
| Mancato rispetto SLA critico    | € 500 per evento               | 5% importo  |
| Indisponibilità sistema > 4h    | € 1.000 per evento             | 5% importo  |

---

_Capitolato redatto da {{responsabile_procedimento}} — {{ente_appaltante}}_
