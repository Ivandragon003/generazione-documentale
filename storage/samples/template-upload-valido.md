# {{titolo}}

**Committente:** {{cliente}}  
**Referente operativo:** {{referente}}  
**Data emissione:** {{data}}  
**Codice interno:** {{codice}}  
**Versione documento:** {{versione}}

\newpage

## 1. Sintesi esecutiva

Il presente documento descrive il piano tecnico, organizzativo ed economico per la realizzazione del progetto **{{titolo}}**.
L'obiettivo e fornire una base contrattuale completa, verificabile e pronta per la generazione PDF automatica.

### 1.1 Obiettivi principali

- Consolidare i requisiti funzionali e non funzionali.
- Definire responsabilita, milestone e criteri di accettazione.
- Stabilire un modello di controllo qualita basato su evidenze.
- Tracciare rischi, dipendenze e azioni di mitigazione.

### 1.2 Ambito

{{ambito}}

\newpage

## 2. Dati amministrativi

| Voce | Valore |
|---|---|
| Cliente | {{cliente}} |
| Referente | {{referente}} |
| Codice progetto | {{codice}} |
| Centro di costo | {{centro_costo}} |
| Responsabile fornitore | {{responsabile_fornitore}} |
| Durata stimata | {{durata}} |
| Priorita | {{priorita}} |

## 3. Architettura proposta

La soluzione viene articolata in quattro livelli logici:

1. **Interfaccia applicativa** per la gestione dei documenti e dei template.
2. **API di dominio** per validazione, versionamento, audit e generazione.
3. **Persistenza dati** con tracciamento delle versioni e degli eventi rilevanti.
4. **Storage documentale** per template Markdown, allegati e PDF finali.

### 3.1 Flusso operativo

| Fase | Input | Output | Controllo |
|---|---|---|---|
| Raccolta requisiti | Interviste, documenti esistenti | Backlog validato | Verbale di approvazione |
| Modellazione template | Markdown e campi dinamici | Template versionato | Validazione campi |
| Generazione documento | Valori compilati | Documento pronto | Audit evento |
| Produzione PDF | Documento validato | PDF finale | Esito Pandoc |
| Collaudo | PDF e checklist | Verbale firmato | Firma responsabili |

\newpage

## 4. Piano attivita

| ID | Attivita | Responsabile | Durata | Deliverable |
|---|---|---|---:|---|
| A1 | Analisi funzionale dettagliata | {{referente}} | 5 gg | Documento requisiti |
| A2 | Setup ambiente e database | {{responsabile_fornitore}} | 3 gg | Ambiente attivo |
| A3 | Implementazione gestione template | Team sviluppo | 8 gg | API e storage |
| A4 | Implementazione generazione PDF | Team sviluppo | 6 gg | Pipeline PDF |
| A5 | Test regressione e collaudo | QA | 4 gg | Report test |
| A6 | Rilascio controllato | DevOps | 2 gg | Release note |

## 5. Requisiti funzionali

### 5.1 Gestione template

- Creazione template da contenuto Markdown.
- Upload di file `.md` con validazione sintattica.
- Versionamento automatico a ogni modifica pubblicata.
- Ripristino di versioni precedenti.
- Esportazione Markdown originale.

### 5.2 Gestione documenti

- Creazione documento da template pubblicato.
- Compilazione dei campi dinamici.
- Storico delle versioni documento.
- Audit delle operazioni rilevanti.
- Generazione PDF asincrona e preview temporanea.

\newpage

## 6. Requisiti non funzionali

| Categoria | Requisito | Soglia minima |
|---|---|---|
| Disponibilita | Servizio API disponibile in orario lavorativo | {{sla_disponibilita}} |
| Performance | Generazione PDF standard | entro {{tempo_pdf}} |
| Tracciabilita | Audit per creazione, modifica e generazione | 100% eventi critici |
| Sicurezza | Separazione configurazioni ambiente | obbligatoria |
| Manutenibilita | Template testabili e versionati | obbligatoria |

## 7. Piano economico

| Voce | Importo |
|---|---:|
| Analisi e progettazione | {{costo_analisi}} |
| Sviluppo backend/API | {{costo_sviluppo}} |
| Generazione PDF e storage | {{costo_pdf}} |
| Test e collaudo | {{costo_test}} |
| Formazione e avvio | {{costo_formazione}} |
| **Totale imponibile** | **{{totale_imponibile}}** |
| IVA | {{iva}} |
| **Totale progetto** | **{{totale_progetto}}** |

\newpage

## 8. Matrice rischi

| Rischio | Probabilita | Impatto | Mitigazione |
|---|---:|---:|---|
| Template non conformi | Media | Alto | Validazione upload e test preview |
| Campi obbligatori mancanti | Media | Medio | Controllo strict prima della generazione |
| Dipendenza da Pandoc/MiKTeX | Bassa | Alto | Check prerequisiti e logging errori |
| Crescita dimensione PDF | Media | Medio | Limite dimensione Markdown e timeout |
| Ambiguita requisiti | Media | Alto | Verbali e accettazione per milestone |

## 9. Criteri di accettazione

Il progetto si considera accettato quando:

- tutte le API documentate risultano disponibili;
- i template possono essere creati, caricati, pubblicati e ripristinati;
- almeno un documento viene generato correttamente in PDF;
- gli eventi principali sono presenti nell'audit log;
- i test di regressione API risultano superati;
- il verbale di collaudo viene firmato dalle parti.

## 10. Collaudo

| Test | Descrizione | Esito atteso |
|---|---|---|
| T1 | Upload template Markdown valido | Template creato |
| T2 | Upload template corrotto | Errore di validazione |
| T3 | Creazione documento | Documento persistito |
| T4 | Preview PDF | PDF temporaneo visualizzabile |
| T5 | Generazione PDF asincrona | Job completato |
| T6 | Download ultimo PDF | File PDF disponibile |

\newpage

## 11. Note finali

{{note_finali}}

## 12. Firme

| Ruolo | Nominativo | Firma |
|---|---|---|
| Committente | {{firma_cliente}} | ______________________________ |
| Fornitore | {{firma_fornitore}} | ______________________________ |
| Responsabile collaudo | {{firma_collaudo}} | ______________________________ |

**Esito previsto:** {{esito}}
