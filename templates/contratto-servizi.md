# Contratto di Servizi Professionali

**N. Contratto:** `{{numero_contratto}}`  
**Data:** `{{data_stipula}}`

---

## 1. Parti Contraenti

### Committente

| Campo            | Valore                      |
| ---------------- | --------------------------- |
| Ragione Sociale  | {{ragione_sociale_cliente}} |
| Partita IVA      | {{partita_iva_cliente}}     |
| Indirizzo Legale | {{indirizzo_cliente}}       |
| Referente        | {{referente_cliente}}       |

### Fornitore

| Campo           | Valore                        |
| --------------- | ----------------------------- |
| Ragione Sociale | {{ragione_sociale_fornitore}} |
| Partita IVA     | {{partita_iva_fornitore}}     |

---

## 2. Oggetto del Contratto

Il presente contratto disciplina la fornitura di servizi professionali di consulenza e sviluppo software da parte del **Fornitore** nei confronti del **Committente**, secondo le modalità e i termini di seguito descritti.

### 2.1 Attività incluse

| #   | Attività                | Unità    | Quantità                  | Note               |
| --- | ----------------------- | -------- | ------------------------- | ------------------ |
| 1   | Sviluppo backend NestJS | ore      | {{ore_sviluppo_backend}}  | incluso nel canone |
| 2   | Sviluppo frontend React | ore      | {{ore_sviluppo_frontend}} | incluso nel canone |
| 3   | Code review e testing   | ore      | {{ore_testing}}           | incluso nel canone |
| 4   | Documentazione tecnica  | ore      | {{ore_documentazione}}    | incluso nel canone |
| 5   | Supporto e manutenzione | ore/mese | {{ore_supporto_mensile}}  | incluso nel canone |
| 6   | Ore extra oltre soglia  | ore      | a consumo                 | tariffa extra      |

---

## 3. Durata

- **Data di inizio:** {{data_inizio}}
- **Data di scadenza:** {{data_fine}}
- **Rinnovo:** tacito rinnovo annuale salvo disdetta con 30 giorni di preavviso

---

## 4. Corrispettivi Economici

### 4.1 Piano tariffario

| Voce                     | Importo                 | Frequenza      | IVA |
| ------------------------ | ----------------------- | -------------- | --- |
| Canone mensile fisso     | € {{importo_mensile}}   | Mensile        | 22% |
| Ore incluse nel canone   | {{ore_incluse}} ore     | Mensile        | —   |
| Tariffa oraria extra     | € {{costo_ora_extra}}/h | A consumo      | 22% |
| Importo totale contratto | € {{importo_totale}}    | Totale periodo | 22% |

### 4.2 Condizioni di pagamento

| Scadenza                  | Importo                           | Descrizione       |
| ------------------------- | --------------------------------- | ----------------- |
| Entro 30 gg dalla fattura | 100% del canone mensile           | Bonifico bancario |
| Ore extra                 | Fatturazione mensile a consuntivo | Entro 30 gg       |

> **IBAN:** {{iban_fornitore}}  
> **Banca:** {{banca_fornitore}}

---

## 5. Livelli di Servizio (SLA)

### 5.1 Classificazione incidenti

| Priorità   | Descrizione                               | Tempo di presa in carico | Tempo di risoluzione |
| ---------- | ----------------------------------------- | ------------------------ | -------------------- |
| 🔴 Critica | Sistema completamente non funzionante     | 1 ora lavorativa         | 4 ore lavorative     |
| 🟠 Alta    | Funzionalità principale degradata         | 2 ore lavorative         | 8 ore lavorative     |
| 🟡 Media   | Funzionalità secondaria non disponibile   | 4 ore lavorative         | 24 ore lavorative    |
| 🟢 Bassa   | Richiesta di miglioramento o informazione | 1 giorno lavorativo      | 5 giorni lavorativi  |

### 5.2 Orario di copertura

| Giorno             | Orario                   |
| ------------------ | ------------------------ |
| Lunedì – Venerdì   | 09:00 – 18:00 (CET/CEST) |
| Sabato             | Solo emergenze critiche  |
| Domenica / Festivi | Solo emergenze critiche  |

### 5.3 Penali per mancato rispetto SLA

| Violazione                   | Penale                                   |
| ---------------------------- | ---------------------------------------- |
| Mancato rispetto SLA critico | € {{penale_sla}} per ogni ora di ritardo |
| Disponibilità mensile < 99%  | 5% del canone mensile                    |
| Disponibilità mensile < 95%  | 15% del canone mensile                   |

---

## 6. Riservatezza

Le parti si impegnano a mantenere riservate tutte le informazioni tecniche, commerciali e strategiche acquisite nell'ambito del presente contratto, per tutta la durata dello stesso e per i **5 anni** successivi alla sua scadenza.

---

## 7. Responsabilità e Limitazioni

| Tipo di danno                    | Responsabilità massima                      |
| -------------------------------- | ------------------------------------------- |
| Danni diretti                    | Fino al valore del contratto annuale        |
| Danni indiretti / lucro cessante | Esclusi                                     |
| Danni a dati                     | Esclusi se backup non gestito dal Fornitore |

---

## 8. Legge Applicabile e Foro Competente

Il presente contratto è regolato dalla legge italiana. Per qualsiasi controversia è competente il Foro di **{{foro_competente}}**.

---

## 9. Firme

| Ruolo       | Nome                    | Data             | Firma            |
| ----------- | ----------------------- | ---------------- | ---------------- |
| Committente | {{referente_cliente}}   | {{data_stipula}} | ____________ |
| Fornitore   | {{referente_fornitore}} | {{data_stipula}} | ____________ |

---

_Documento generato automaticamente — MAC Documents Platform_
