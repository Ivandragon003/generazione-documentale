# MAC Documents — Modulo Documentale

API REST per la generazione di documenti PDF basata su template Markdown.
Costruita con **NestJS** su Node.js, database **PostgreSQL**, generazione PDF tramite **Pandoc**.

---

## Stack tecnico

| Layer | Tecnologia |
|---|---|
| Framework | [NestJS](https://nestjs.com/) v10 (su Express) — JavaScript puro |
| Database | PostgreSQL — query raw con `pg` (no ORM) |
| PDF | Pandoc (`pdflatex` / `xelatex` come motore) |
| Documentazione API | Swagger UI — `http://localhost:3000/api-docs` |

> **Nota:** il progetto usa NestJS **senza TypeScript** (JavaScript puro con decoratori applicati manualmente).
> Vedi la sezione [TypeScript](#note-su-typescript) in fondo per il confronto.

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
│       │   └── http.utils.js            # makeError, wrapAsync, parsePagination...
│       ├── audit/
│       │   ├── audit.module.js
│       │   ├── audit.controller.js
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
│           ├── reset.controller.js
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

### Templates — `/api/templates`

| Metodo | Endpoint | Descrizione |
|---|---|---|
| `GET` | `/api/templates` | Lista template (filtro `status`, paginazione) |
| `POST` | `/api/templates` | Crea template da JSON |
| `GET` | `/api/templates/:id` | Dettaglio template |
| `PUT` | `/api/templates/:id` | Aggiorna (crea nuova versione) |
| `DELETE` | `/api/templates/:id` | Elimina (solo se nessun documento attivo) |
| `POST` | `/api/templates/:id/publish` | Pubblica il template |
| `GET` | `/api/templates/:id/versions` | Cronologia versioni |
| `GET` | `/api/templates/:id/versions/:v` | Contenuto versione specifica |
| `POST` | `/api/templates/:id/restore/:v` | Ripristina versione precedente |
| `GET` | `/api/templates/:id/export` | Scarica template come file `.md` |
| `POST` | `/api/templates/upload` | Importa template da file `.md` (multipart) |
| `POST` | `/api/templates/validate-md` | Valida contenuto Markdown senza salvare |
| `POST` | `/api/templates/validate-file` | Valida file `.md` senza salvare |

### Documents — `/api/documents`

| Metodo | Endpoint | Descrizione |
|---|---|---|
| `GET` | `/api/documents` | Lista documenti (filtro `status`, paginazione) |
| `POST` | `/api/documents` | Crea documento da template |
| `GET` | `/api/documents/:id` | Dettaglio documento |
| `PUT` | `/api/documents/:id` | Aggiorna contenuto / `fieldValues` |
| `DELETE` | `/api/documents/:id` | Elimina documento |
| `PATCH` | `/api/documents/:id/rename` | Rinomina documento |
| `PATCH` | `/api/documents/:id/status` | Cambia stato (`draft` → `published` → `archived`) |
| `POST` | `/api/documents/:id/generate-pdf` | Accoda generazione PDF asincrona → risponde `202` |
| `GET` | `/api/documents/:id/pdf-jobs` | Lista job PDF del documento |
| `GET` | `/api/documents/:id/pdf-jobs/:jobId` | Stato job (`queued` / `running` / `completed` / `failed`) |
| `GET` | `/api/documents/:id/pdf-jobs/:jobId/download` | Scarica PDF del job completato |
| `GET` | `/api/documents/:id/latest-pdf` | Scarica l'ultimo PDF completato |
| `GET` | `/api/documents/:id/preview-pdf` | Anteprima PDF temporanea (non salvata) |
| `GET` | `/api/documents/:id/versions` | Cronologia versioni documento |
| `GET` | `/api/documents/:id/versions/:v` | Contenuto versione specifica |
| `POST` | `/api/documents/:id/restore/:v` | Ripristina versione precedente |
| `GET` | `/api/documents/:id/export-md` | Esporta documento come file `.md` |
| `GET` | `/api/documents/:id/audit` | Audit log del documento |

### Audit — `/api/audit`

| Metodo | Endpoint | Descrizione |
|---|---|---|
| `GET` | `/api/audit` | Registro globale (immutabile) |

### PDF — `/api/pdf`

| Metodo | Endpoint | Descrizione |
|---|---|---|
| `POST` | `/api/pdf/templates/:templateId/validate` | Verifica disponibilità template per generazione |

### Dev/Test — `/api/dev` _(solo `NODE_ENV=development`)_

| Metodo | Endpoint | Descrizione |
|---|---|---|
| `POST` | `/api/dev/reset` | Svuota DB e storage, ricrea fixture stabili |
| `POST` | `/api/dev/test-runs/execute` | Esegue la suite di regression test |
| `POST` | `/api/dev/seed-large-pdf` | Crea contratto 21 campi, compila 9/21, accoda PDF |

`/api/dev/reset` richiede header `x-reset-confirm: true`.

---

## Flusso di utilizzo tipico

```
1. POST /api/templates/validate-md       → verifica il Markdown
2. POST /api/templates                   → crea il template
3. POST /api/templates/:id/publish       → pubblica (obbligatorio prima di usarlo)
4. POST /api/documents                   → crea documento dal template
5. PUT  /api/documents/:id               → compila i fieldValues
6. POST /api/documents/:id/generate-pdf  → accoda generazione → ricevi jobId
7. GET  /api/documents/:id/pdf-jobs/:jobId → polling finché status = "completed"
8. GET  /api/documents/:id/pdf-jobs/:jobId/download → scarica il PDF
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

- Campi `required: true` → bloccano la generazione PDF se non compilati (`strict: true`)
- Campi facoltativi non compilati → sostituiti con `defaultValue` o stringa vuota
- `GET /api/documents/:id/preview-pdf` usa `strict: false` — genera PDF anche con campi mancanti (i `{{placeholder}}` restano visibili)

---

## PDF asincroni

`POST /api/documents/:id/generate-pdf` risponde subito con `202 Accepted` e un `jobId`.
La generazione avviene in background tramite un worker in-process (coda FIFO con concorrenza configurabile via `PDF_JOB_CONCURRENCY`).

```bash
# Polling manuale
GET /api/documents/:id/pdf-jobs/:jobId
# → { "status": "queued" | "running" | "completed" | "failed", "filename": "..." }
```

I PDF completati sono **persistenti** in `./storage/pdf/` e scaricabili in qualsiasi momento.
La preview è invece temporanea: genera e serve il file inline, poi lo cancella.

---

## Testing

### Reset + fixture stabili
```http
POST /api/dev/reset
x-reset-confirm: true
```

Crea fixture con UUID fissi (utili nelle collezioni Bruno/Postman):
```
templateId:  11111111-1111-4111-8111-111111111111
documentId:  22222222-2222-4222-8222-222222222222
pdfJobId:    33333333-3333-4333-8333-333333333333
```

### Regression suite completa
```bash
npm run test:api
# oppure via API:
POST /api/dev/test-runs/execute
{ "suite": "api-regression" }
```

Risponde `200` con `ok: true` se tutti i test passano, `500` con `failedTest` al primo fallimento.

### Test PDF con campi parziali
```http
POST /api/dev/seed-large-pdf
```
Crea un contratto multi-sezione con 21 campi, ne compila 9 e accoda la generazione PDF.
Il file rimane in storage per ispezione.

---

## Header opzionale

`x-user: <nome>` → traccia l'autore nell'audit log. Se assente viene usato `system`.

---

## Collezione Bruno / Postman

- Bruno: cartella `bruno/` nella repo (consigliato — variabili d'ambiente, sequenze salvate)
- Postman: importa `MAC-Documents-API.postman_collection.json`

---

## Note su TypeScript

Il progetto è scritto in **JavaScript puro con NestJS**. Questo funziona, ma NestJS nasce per TypeScript e in JS i decoratori vanno applicati manualmente su ogni metodo e parametro, il che è più verboso e error-prone.

**Cosa migliorerebbe con TypeScript:**

| Aspetto | JS attuale | TS |
|---|---|---|
| Decoratori parametri | `Query()(proto, 'findAll', 0)` a mano | `findAll(@Query() q: QueryDto)` — inline |
| Validazione body | Assente / manuale | `class-validator` + `class-transformer` su DTO |
| Tipo delle righe DB | `any` implicito | `interface TemplateRow { id: string; ... }` |
| Errori di battitura | Runtime | Compile time |
| IntelliSense | Parziale | Completo |
| Documentazione Swagger | `@ApiProperty()` a mano | Generata automaticamente dai DTO |

**Stima migrazione:** 2–3 giorni per un progetto di questa dimensione — principalmente rinominare i file in `.ts`, aggiungere `tsconfig.json`, definire i DTO e tipare le query DB.
