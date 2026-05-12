# Offerta Commerciale

**N. Offerta:** {{numero_offerta}}  
**Data:** {{data_offerta}}  
**Valida fino al:** {{validita_offerta}}

---

## Destinatario

| Campo     | Valore                    |
| --------- | ------------------------- |
| Cliente   | {{nome_cliente}}          |
| Referente | {{referente_commerciale}} |

---

## 1. Riepilogo Esecutivo

In risposta alla Vostra richiesta, siamo lieti di presentare la seguente offerta commerciale per la fornitura di servizi di sviluppo software e consulenza tecnologica.

---

## 2. Listino Servizi

### 2.1 Pacchetti di sviluppo

| Servizio       | Descrizione                  | Unità | Prezzo unitario | Q.tà             | Totale             |
| -------------- | ---------------------------- | ----- | --------------- | ---------------- | ------------------ |
| Dev Backend    | Sviluppo API NestJS/Node.js  | ora   | € 85,00         | {{qty_backend}}  | € {{tot_backend}}  |
| Dev Frontend   | Sviluppo React/TypeScript    | ora   | € 80,00         | {{qty_frontend}} | € {{tot_frontend}} |
| DevOps / CI-CD | Pipeline, Docker, deploy     | ora   | € 90,00         | {{qty_devops}}   | € {{tot_devops}}   |
| UX/UI Design   | Wireframe, prototyping       | ora   | € 75,00         | {{qty_design}}   | € {{tot_design}}   |
| QA & Testing   | Test automatizzati e manuali | ora   | € 65,00         | {{qty_qa}}       | € {{tot_qa}}       |
| Tech Lead      | Architettura, code review    | ora   | € 110,00        | {{qty_techlead}} | € {{tot_techlead}} |

### 2.2 Licenze e infrastruttura

| Voce                          | Tipo                  | Costo mensile              | Costo annuale                   |
| ----------------------------- | --------------------- | -------------------------- | ------------------------------- |
| Server cloud (produzione)     | VPS 8 core / 16GB RAM | € {{costo_server_prod}}    | € {{costo_server_prod_anno}}    |
| Server cloud (staging)        | VPS 4 core / 8GB RAM  | € {{costo_server_staging}} | € {{costo_server_staging_anno}} |
| Database managed (PostgreSQL) | 100GB storage         | € {{costo_db}}             | € {{costo_db_anno}}             |
| CDN e object storage          | 500GB bandwidth       | € {{costo_cdn}}            | € {{costo_cdn_anno}}            |
| Monitoraggio (uptime + APM)   | SaaS                  | € {{costo_monitoring}}     | € {{costo_monitoring_anno}}     |
| Backup offsite giornaliero    | 30 giorni retention   | € {{costo_backup}}         | € {{costo_backup_anno}}         |

### 2.3 Canone manutenzione post-go-live

| Livello  | Ore incluse/mese      | SLA risposta   | Prezzo mensile        |
| -------- | --------------------- | -------------- | --------------------- |
| Base     | 4 ore                 | 24h lavorative | € {{canone_base}}     |
| Standard | 10 ore                | 8h lavorative  | € {{canone_standard}} |
| Premium  | 20 ore + reperibilità | 2h lavorative  | € {{canone_premium}}  |

---

## 3. Riepilogo Economico

| Voce                                         | Importo                        |
| -------------------------------------------- | ------------------------------ |
| Totale servizi di sviluppo                   | € {{subtotale_sviluppo}}       |
| Totale licenze e infrastruttura (anno 1)     | € {{subtotale_infrastruttura}} |
| **Subtotale**                                | **€ {{subtotale}}**            |
| Sconto commerciale ({{sconto_percentuale}}%) | - € {{importo_sconto}}         |
| **Totale netto**                             | **€ {{totale_netto}}**         |
| IVA 22%                                      | € {{importo_iva}}              |
| **Totale con IVA**                           | **€ {{totale_ivato}}**         |

---

## 4. Condizioni di Pagamento

| Milestone                         | %   | Importo              | Scadenza               |
| --------------------------------- | --- | -------------------- | ---------------------- |
| Firma contratto                   | 30% | € {{acconto}}        | Alla firma             |
| Consegna ambiente staging         | 30% | € {{saldo_staging}}  | Collaudo staging       |
| Go-live produzione                | 30% | € {{saldo_golive}}   | Collaudo produzione    |
| Fine periodo di garanzia (3 mesi) | 10% | € {{saldo_garanzia}} | +90 giorni dal go-live |

**Condizioni:** {{condizioni_pagamento}}  
**Modalità:** Bonifico bancario a 30 giorni dalla data fattura

---

## 5. Tempistiche Stimate

| Fase                | Durata stimata    | Dipendenze        |
| ------------------- | ----------------- | ----------------- |
| Kickoff e analisi   | 1 settimana       | Firma contratto   |
| Sviluppo MVP        | 6 settimane       | Analisi approvata |
| Test e correzioni   | 2 settimane       | MVP completato    |
| Deploy e formazione | 1 settimana       | Test superati     |
| **Totale**          | **~10 settimane** |                   |

**Data di consegna stimata:** {{data_consegna}}

---

## 6. Garanzie Incluse

| Garanzia                    | Durata     | Dettaglio                 |
| --------------------------- | ---------- | ------------------------- |
| Correzione bug post go-live | 90 giorni  | Gratuita, illimitata      |
| Aggiornamenti di sicurezza  | 12 mesi    | Inclusi nel canone        |
| Documentazione tecnica      | Permanente | Aggiornata a ogni release |
| Formazione utenti           | 2 giorni   | Inclusa nel progetto      |

---

_Offerta preparata da {{referente_commerciale}} — Valida fino al {{validita_offerta}}_  
_Per accettare questa offerta rispondere via email confermando il numero offerta {{numero_offerta}}_
