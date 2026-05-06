# MAC Documents — Modulo Documentale

API REST per la generazione di documenti PDF basata su template Markdown.
Costruita con **NestJS** su Node.js, database **PostgreSQL**, generazione PDF tramite **Pandoc**.

---

## Stack tecnico

| Layer | Tecnologia |
|---|---|
| Framework | [NestJS](https://nestjs.com/) v11 + TypeScript |
| Database | PostgreSQL + TypeORM |
| PDF | Pandoc + XeLaTeX |
| Documentazione API | Swagger UI — `http://localhost:3000/api-docs` |


---

## Prerequisiti

- Node.js >= 18
- PostgreSQL in esecuzione (locale o Docker)
- Pandoc installato
  ```bash
  # Ubuntu/Debian
  sudo apt install pandoc texlive-latex-base

  # macOS
  brew install pandoc
  brew install --cask mactex
  ```

---

## Setup rapido

### 1. Installa le dipendenze
```bash
npm install
```

### 2. Configura `.env`
```env
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
MAX_TEMPLATE_CONTENT_BYTES=200000

PANDOC_PATH=pandoc
PANDOC_PDF_ENGINE=pdflatex
```

### 3. Crea il database
```sql
CREATE DATABASE mac_documents;
```

### 4. Esegui le migrazioni
```bash
npm run migrate
```

### 5. Avvia il server
```bash
npm run start:dev   # con nodemon (riavvio automatico)
npm start           # senza nodemon
```

- Server: `http://localhost:3000`
- Health check: `http://localhost:3000/health`
- Swagger UI: `http://localhost:3000/api-docs`

---

## Struttura del progetto

```
mac-documents/
├── src/
│   ├── main.js                          # Bootstrap NestJS
│   ├── app.module.js                    # Modulo radice
│   ├── database/
│   │   └── database.js                  # Pool PostgreSQL + withTransaction()
│   └── modules/
│       ├── common/
│       │   └── http.utils.js            # makeError, parsePagination, parseVersionOrThrow...
│       ├── audit/
│       │   ├── audit.service.js
│       │   └── audit.queries.js
│       ├── templates/
│       │   ├── template.module.js
│       │   ├── templates.controller.js
│       │   ├── templates.service.js
│       │   └── templates.queries.js
│       ├── documents/
│       │   ├── document.module.js
│       │   ├── documents.controller.js
│       │   ├── documents.service.js
│       │   ├── documents.queries.js
│       │   ├── pdf.controller.js
│       │   └── pdf.service.js
│       └── dev/
│           ├── dev.module.js
│           ├── dev.controller.js
│           ├── dev.queries.js
│           └── api-regression.service.js
├── db/                                  # File .sql (schema, seed)
├── migrations/
│   └── run.js
├── scripts/
│   ├── check-pandoc.js
│   └── run-api-tests.js
├── storage/
│   ├── pdf/                             # PDF generati (persistenti)
│   ├── templates/                       # File .md dei template per versione
│   └── uploads/                         # Upload temporanei
└── package.json
```

---

## API Endpoints

### Templates - `/api/templates`

| Metodo | Endpoint | Descrizione |
|---|---|---|
| `GET` | `/api/templates` | Lista template (filtro `status`, paginazione) |
| `POST` | `/api/templates` | Crea template da JSON |
| `GET` | `/api/templates/:id` | Dettaglio template |
| `PUT` | `/api/templates/:id` | Aggiorna template e crea una nuova versione |
| `DELETE` | `/api/templates/:id` | Elimina template |
| `GET` | `/api/templates/:id/versions` | Cronologia versioni |
| `GET` | `/api/templates/:id/versions/:v` | Contenuto versione specifica |
| `POST` | `/api/templates/:id/restore/:v` | Ripristina versione precedente |
| `GET` | `/api/templates/:id/export` | Scarica template come file `.md` |
| `GET` | `/api/templates/:id/audit` | Audit log del template |
| `POST` | `/api/templates/upload` | Importa template da file `.md` (multipart) |
| `POST` | `/api/templates/validate-md` | Valida contenuto Markdown senza salvare |

Endpoint rimossi/non esposti attualmente: `POST /api/templates/:id/publish`, `POST /api/templates/validate-file`.

### Documents - `/api/documents`

| Metodo | Endpoint | Descrizione |
|---|---|---|
| `GET` | `/api/documents` | Lista documenti (filtro `status`, paginazione) |
| `POST` | `/api/documents` | Crea documento da template |
| `GET` | `/api/documents/:id` | Dettaglio documento |
| `PUT` | `/api/documents/:id` | Aggiorna contenuto / `fieldValues` |
| `DELETE` | `/api/documents/:id` | Elimina documento |
| `POST` | `/api/documents/:id/generate-pdf` | Accoda generazione PDF asincrona e risponde `202` |
| `GET` | `/api/documents/:id/pdf/latest` | Scarica l'ultimo PDF completato |
| `GET` | `/api/documents/:id/preview-pdf` | Anteprima PDF temporanea (non salvata) |
| `GET` | `/api/documents/:id/versions` | Cronologia versioni documento |
| `GET` | `/api/documents/:id/versions/:v` | Contenuto versione specifica |
| `POST` | `/api/documents/:id/restore/:v` | Ripristina versione precedente |
| `GET` | `/api/documents/:id/export-md` | Esporta documento come file `.md` |
| `GET` | `/api/documents/:id/audit` | Audit log del documento |

Endpoint rimossi/non esposti attualmente: `PATCH /api/documents/:id/rename`, `PATCH /api/documents/:id/status`, `GET /api/documents/:id/pdf-jobs*`, `GET /api/documents/:id/latest-pdf`.

### Audit

Non esiste una route globale `/api/audit`. L'audit e' esposto sulle entita':

| Metodo | Endpoint | Descrizione |
|---|---|---|
| `GET` | `/api/templates/:id/audit` | Audit log del template |
| `GET` | `/api/documents/:id/audit` | Audit log del documento |

### PDF - `/api/pdf`

| Metodo | Endpoint | Descrizione |
|---|---|---|
| `POST` | `/api/pdf/templates/:templateId/validate` | Verifica disponibilita template per generazione PDF |

### Dev - `/api/dev`

| Metodo | Endpoint | Descrizione |
|---|---|---|
| `POST` | `/api/dev/reset` | Svuota DB e storage, ricrea fixture stabili |
| `POST` | `/api/dev/seed-large-pdf` | Crea contratto 21 campi, compila 9/21, accoda PDF |

`/api/dev/reset` richiede header `x-reset-confirm: true`.

La route tecnica `POST /api/dev/test-runs/execute` esiste, ma non e' nella collection Bruno/Postman: la regression suite parte automaticamente all'avvio del backend.

---

## Flusso di utilizzo tipico

```
1. POST /api/dev/reset                   -> reset fixture stabili (opzionale, ambiente dev)
2. POST /api/templates/validate-md       -> verifica il Markdown
3. POST /api/templates                   -> crea il template
4. POST /api/documents                   -> crea documento dal template
5. PUT  /api/documents/:id               -> compila i fieldValues
6. POST /api/documents/:id/generate-pdf  -> accoda generazione e ricevi jobId
7. GET  /api/documents/:id/pdf/latest    -> scarica l'ultimo PDF completato
```

---

## Campi template (`fieldValues`)

I template usano placeholder `{{nome_campo}}` nel Markdown.

```json
{
  "name": "titolo",
  "label": "Titolo documento",
  "type": "text",
  "required": true,
  "defaultValue": ""
}
```

- Campi `required: true`: bloccano la generazione PDF se non compilati (`strict: true`).
- Campi facoltativi non compilati: sostituiti con `defaultValue` o stringa vuota.
- `GET /api/documents/:id/preview-pdf` usa `strict: false`: genera PDF anche con campi mancanti; i placeholder restano visibili.

---

## PDF asincroni

`POST /api/documents/:id/generate-pdf` risponde subito con `202 Accepted` e un `jobId`.
La generazione avviene in background tramite un worker in-process.

Attualmente non sono esposte route di polling `pdf-jobs`. Per scaricare il PDF completato usa:

```http
GET /api/documents/:id/pdf/latest
```

Se la generazione non e' ancora conclusa, la richiesta puo' rispondere `404` finche' non esiste un PDF completato.

I PDF completati sono persistenti in `./storage/pdf/`. La preview e' temporanea: genera e serve il file inline, poi lo cancella.

---

## Testing

### Reset + fixture stabili
```http
POST /api/dev/reset
x-reset-confirm: true
```

Crea fixture con UUID fissi, usati anche nella collection Bruno/Postman:

```
template_id:         11111111-1111-4111-8111-111111111111
template_delete_id:  11111111-1111-4111-8111-111111111112
document_id:         22222222-2222-4222-8222-222222222222
pdf_job_id:          33333333-3333-4333-8333-333333333333
```

### Regression suite

La regression suite viene eseguita automaticamente all'avvio del backend. Per questo la collection `MAC-Documents-API.postman_collection.json` non richiama `/api/dev/test-runs/execute`.

Per lanciarla manualmente da terminale:

```bash
npm run test:api
```

### Test PDF con campi parziali
```http
POST /api/dev/seed-large-pdf
```

Crea un contratto multi-sezione con 21 campi, ne compila 9 e accoda la generazione PDF.
Il file rimane in storage per ispezione.

---

## Header opzionale

`x-user: <nome>` traccia l'autore nell'audit log. Se assente viene usato `system`.

---

## Collezione Bruno / Postman

Usa Bruno importando il file:

```
MAC-Documents-API.postman_collection.json
```

La collection non contiene script Postman `pm.*` e non richiama la suite test automatica.

---

## Note su TypeScript

Il progetto � gi� in TypeScript (src/**/*.ts) con validazione DTO (class-validator) e dependency injection NestJS standard.

