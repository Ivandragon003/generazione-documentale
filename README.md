# MAC Documents - Modulo Documentale

## Stack
- Node.js + Express (API REST)
- PostgreSQL (database)
- Pandoc (generazione PDF da Markdown)

## Prerequisiti
- Node.js >= 18
- PostgreSQL in esecuzione (locale o Docker)
- Pandoc installato (`sudo apt install pandoc` / `brew install pandoc`)

## Setup rapido

### 1. Installa dipendenze
```bash
npm install
```

### 2. Configura .env
```
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=mac_documents
PORT=3000
STORAGE_PATH=./storage/pdf
TEMPLATE_STORAGE_PATH=./storage/templates
UPLOAD_PATH=./storage/uploads
MAX_FILE_SIZE_MB=10
PANDOC_PATH=pandoc
PANDOC_PDF_ENGINE=pdflatex
```

### 3. Crea il database
```bash
CREATE DATABASE mac_documents;
```

### 4. Esegui le migrazioni
```bash
npm run migrate
```

### 5. Avvia il server
```bash
npm run start:dev
# oppure
npm start
```

Server: `http://localhost:3000`
Health check: `http://localhost:3000/health`

## Struttura cartelle

```text
src/
  main.js
  database.js
  modules/
    templates/
      templates.service.js
      templates.controller.js
    documents/
      documents.service.js
      documents.controller.js
      pdf.service.js
      pdf.controller.js
    audit/
      audit.service.js
      audit.controller.js
migrations/
  run.js
storage/
  templates/
  pdf/
  uploads/
  samples/
```

## API Endpoints

### Templates
| Metodo | Endpoint | Descrizione |
|--------|----------|-------------|
| GET | /api/templates | Lista templates |
| POST | /api/templates | Crea template |
| GET | /api/templates/:id | Dettaglio |
| PUT | /api/templates/:id | Aggiorna (crea nuova versione) |
| POST | /api/templates/:id/publish | Pubblica |
| GET | /api/templates/:id/versions | Cronologia versioni |
| GET | /api/templates/:id/versions/:v | Contenuto versione |
| POST | /api/templates/:id/restore/:v | Ripristina versione |
| GET | /api/templates/:id/export | Download .md |
| POST | /api/templates | Upload .md |
| POST | /api/templates/validate-md | Valida contenuto Markdown |
| POST | /api/templates/validate-file | Valida file Markdown caricato |
| DELETE | /api/templates/:id | Elimina |

### Documents
| Metodo | Endpoint | Descrizione |
|--------|----------|-------------|
| GET | /api/documents | Lista documenti |
| POST | /api/documents | Crea da template |
| GET | /api/documents/:id | Dettaglio |
| PUT | /api/documents/:id | Aggiorna contenuto/campi |
| PATCH | /api/documents/:id/rename | Rinomina |
| PATCH | /api/documents/:id/status | Cambia stato |
| POST | /api/documents/:id/generate-pdf | Accoda generazione PDF asincrona |
| GET | /api/documents/:id/pdf-jobs | Lista job PDF |
| GET | /api/documents/:id/pdf-jobs/:jobId | Dettaglio job PDF |
| GET | /api/documents/:id/pdf-jobs/:jobId/download | Download PDF del job |
| GET | /api/documents/:id/latest-pdf | Download ultimo PDF completato |
| GET | /api/documents/:id/preview-pdf | Anteprima PDF |
| GET | /api/documents/:id/export-md | Export .md |
| GET | /api/documents/:id/versions | Versioni |
| GET | /api/documents/:id/versions/:v | Contenuto versione |
| POST | /api/documents/:id/restore/:v | Ripristina versione |
| GET | /api/documents/:id/audit | Audit log documento |
| DELETE | /api/documents/:id | Elimina documento |

### PDF
| Metodo | Endpoint | Descrizione |
|--------|----------|-------------|
| POST | /api/pdf/templates/:templateId/validate | Valida disponibilita template |

### Dev/Test
| Metodo | Endpoint | Descrizione |
|--------|----------|-------------|
| POST | /api/dev/reset | Svuota dati e storage locale/test |
| POST | /api/dev/test-runs/execute | Esegue subito la suite tecnica e ritorna pass/fail |

`/api/dev/reset` richiede header `x-reset-confirm: true` ed e bloccato con `NODE_ENV=production`.
`/api/dev/reset` crea anche fixture stabili per la collection: template, documento e job PDF con UUID fissi. L'endpoint `/api/dev/test-runs/execute` e tecnico: serve per lanciare i test senza trasformare scenari come "Markdown corrotto" o "Documento incompleto" in API di dominio. E bloccato con `NODE_ENV=production`.

### Audit
| Metodo | Endpoint | Descrizione |
|--------|----------|-------------|
| GET | /api/audit | Registro globale |

## Content e field_values

`documents.content` contiene il Markdown del documento, copiato dal template quando crei il documento.
`documents.field_values` contiene solo i valori strutturati dei placeholder, per esempio `titolo`, `budget`, `firma`.

Se un documento e appena creato, `field_values` e `{}`. Dopo una `PUT /api/documents/:id` con `fieldValues`, contiene solo i campi inviati. In preview/PDF i placeholder presenti in `content` vengono risolti usando `field_values`; in modalita strict la generazione PDF fallisce se rimangono placeholder non compilati.

## Campi template

`templates.fields` contiene definizioni strutturate:

```json
[
  {
    "name": "titolo",
    "label": "Titolo",
    "type": "text",
    "required": true,
    "defaultValue": ""
  }
]
```

I campi `required: true` bloccano la generazione PDF se non compilati. I campi opzionali non compilati vengono sostituiti con `defaultValue` oppure stringa vuota.

## PDF asincroni

`POST /api/documents/:id/generate-pdf` non genera piu il PDF dentro la richiesta HTTP: crea un record in `pdf_jobs`, risponde `202` con `jobId`, poi un worker in-process esegue Pandoc in background.

Usa:

```http
GET /api/documents/:id/pdf-jobs/:jobId
```

per leggere `queued`, `running`, `completed` o `failed`. In produzione SaaS lo stesso contratto API puo restare uguale, ma il worker in-process va sostituito con una queue esterna.

I PDF generati via job sono persistenti e scaricabili da `pdf-jobs/:jobId/download` o da `latest-pdf`. La preview rimane temporanea: genera un PDF per visualizzazione inline e lo cancella alla fine dello stream.

## Validazione Markdown

`POST /api/templates/validate-md` accetta:

```json
{
  "content": "# {{titolo}}\n\nTesto normale\n\nCliente: {{committente}}"
}
```

Risponde con `valid`, `errors`, `warnings` e `fields`. Serve per controllare in modo pratico se un `.md` e usabile come template prima di importarlo o salvarlo.

## Header opzionale
Usa `x-user: <username>` per tracciare l'autore su audit log. Se assente viene usato `system`.

## Postman
Importa `MAC-Documents-API.postman_collection.json`.

La collection contiene le singole chiamate agli endpoint reali, con nomi come `POST /api/templates/validate-md` o `GET /api/documents/:id`.

Gli scenari particolari non sono piu richieste Postman separate: si lanciano con `POST /api/dev/test-runs/execute`. Quell'endpoint esegue i test tecnici, per esempio input corrotto, verifica campi, creazione template/documento e job PDF. Se tutto passa risponde `200` con `ok: true`; se un test fallisce risponde `500` con `failedTest`.

La richiesta `POST /api/dev/reset` cancella i dati vecchi, pulisce le cartelle `storage/templates`, `storage/pdf` e `storage/uploads`, poi ricrea fixture stabili usate dalle chiamate con `:id`.
Non eseguire il reset alla fine, altrimenti cancelli i dati appena creati e non puoi ispezionarli.

Per eseguire tutta la suite da terminale:

```bash
npm run test:api
```

Lo script chiama `POST /api/dev/test-runs/execute` e fallisce con exit code `1` se un test non passa.

Per avviarla via API tecnica:

```http
POST /api/dev/test-runs/execute
Content-Type: application/json

{
  "suite": "api-regression"
}
```

## PDF con LaTeX

Il progetto usa gia Pandoc per produrre PDF. Pandoc puo usare LaTeX come motore (`pdflatex`, `xelatex`, `lualatex`) tramite `--pdf-engine`.
Passare a PDF "in LaTeX" non e complicato se continui a partire da Markdown: basta installare una distribuzione LaTeX e configurare il motore Pandoc.
Diventa piu impegnativo se vuoi generare direttamente file `.tex`, perche devi gestire escaping dei caratteri, template LaTeX, pacchetti, font, tabelle lunghe e diagnostica degli errori.

La generazione PDF funziona solo tramite Pandoc. Se Node non trova `pandoc`, imposta `PANDOC_PATH` nel `.env` con il percorso completo dell'eseguibile. Se Pandoc non trova `pdflatex`, imposta `PANDOC_PDF_ENGINE` con il percorso completo del motore PDF, per esempio MiKTeX.
Pandoc viene eseguito con `execFile`, timeout e senza shell. I template bloccano placeholder invalidi, HTML script/iframe e comandi LaTeX di input/output.
