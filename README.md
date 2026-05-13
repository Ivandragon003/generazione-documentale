# MAC Documents

Piattaforma documentale composta da backend NestJS, frontend React e servizio PDF opzionale separato.

## Architettura reale

- `src/` Backend NestJS (API REST, integrazione GitHub template, queue job PDF, persistenza metadata su PostgreSQL).
- `frontend/` Frontend React + Vite (editor template, compilazione campi, stato job PDF, download PDF).
- `scripts/pdf-service.mjs` Servizio Node standalone per rendering PDF remoto (Pandoc/LaTeX in container dedicato).
- `scripts/check-pandoc.ts` Verifica toolchain Pandoc locale.
- `scripts/seed.ts` Seeder database metadata template.

## Flusso end-to-end

1. I template Markdown sono la sorgente primaria su GitHub (`GITHUB_OWNER`, `GITHUB_REPO`, `GITHUB_BRANCH`, `GITHUB_TEMPLATES_DIR`).
2. Il backend legge template/metadata da GitHub, normalizza placeholder `{{campo}}` o `{{campo:tipo}}`, e unisce metadata DB (nome, descrizione, fields, mapping path).
3. Il frontend mostra il template, genera i controlli di compilazione dai placeholder/fields e produce l'anteprima HTML.
4. `POST /api/templates/:id/pdf` crea un job asincrono (`queued -> running -> completed/failed`).
5. Il worker backend processa la coda:
   - rendering Markdown compilato;
   - conversione PDF via `pdf-service` remoto oppure Pandoc locale (solo fallback dev).
6. Il frontend monitora stato job (`GET /api/templates/:id/pdf/jobs/:jobId`) e scarica il PDF completato (`/download` o `/latest`).

## API attuali (backend)

Health:
- `GET /health`
- `GET /health/pdf`

Template:
- `GET /api/templates`
- `GET /api/templates/:id`
- `POST /api/templates`
- `PUT /api/templates/:id`
- `DELETE /api/templates/:id`

PDF async:
- `POST /api/templates/:id/pdf`
- `GET /api/templates/:id/pdf/jobs`
- `GET /api/templates/:id/pdf/jobs/:jobId`
- `GET /api/templates/:id/pdf/jobs/:jobId/download`
- `GET /api/templates/:id/pdf/latest`

OpenAPI UI: `GET /api-docs`  
Spec file (non-production boot): `openapi.json`

## Struttura cartelle

```text
.
├─ src/
│  ├─ common/
│  ├─ config/
│  ├─ controller/
│  ├─ dto/
│  ├─ entities/
│  ├─ migrations/
│  ├─ repository/
│  └─ service/
├─ frontend/
│  ├─ src/components/
│  ├─ src/data/
│  └─ src/utils/
├─ scripts/
├─ test/
├─ Dockerfile
├─ Dockerfile.pdf
└─ docker-compose.yml
```

## Variabili environment

File di riferimento: `.env.example`.

Backend:
- `NODE_ENV`, `PORT`
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
- `GITHUB_TOKEN`, `GITHUB_OWNER`, `GITHUB_REPO`, `GITHUB_BRANCH`, `GITHUB_TEMPLATES_DIR`
- `MAX_TEMPLATE_CONTENT_BYTES`, `MAX_PDF_MARKDOWN_BYTES`
- `PDF_SERVICE_URL`
- `ENABLE_LOCAL_PDF_FALLBACK` (`true|false`)
- `PANDOC_PATH`, `PDF_ENGINE`
- `PDF_GENERATION_RETRIES`, `PDF_GENERATION_RETRY_DELAY_MS`, `PDF_GENERATION_TIMEOUT_MS`, `PDF_QUEUE_RECOVERY_RETRY_MS`
- `PDF_PAPER`, `PDF_FONT_SIZE`, `PDF_MARGIN_TOP`, `PDF_MARGIN_BOTTOM`, `PDF_MARGIN_LEFT`, `PDF_MARGIN_RIGHT`
- `PDF_MAIN_FONT`, `PDF_SANS_FONT`, `PDF_MONO_FONT`
- `RUN_REGRESSION_ON_BOOT`

Frontend:
- `VITE_API_URL` (base URL backend, default `http://localhost:3000`)

## Setup locale

Prerequisiti:
- Node.js 22+
- PostgreSQL 16+
- Accesso GitHub con token valido ai template
- Pandoc + engine LaTeX solo se non si usa `PDF_SERVICE_URL`

Backend:

```bash
npm install
npm run build
npm run start:dev
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Verifica Pandoc locale:

```bash
npm run check:pandoc
```

## Modalita PDF (dev/prod)

- `NODE_ENV=production`:
  - `PDF_SERVICE_URL` e obbligatoria.
  - fallback locale disabilitato di default.
  - se `PDF_SERVICE_URL` manca, il backend fallisce all'avvio (fail-fast).
- `NODE_ENV=development` o `test`:
  - se `PDF_SERVICE_URL` e presente, usa modalita remota;
  - se assente, puo usare fallback locale Pandoc;
  - `ENABLE_LOCAL_PDF_FALLBACK=false` forza errore esplicito quando manca `PDF_SERVICE_URL`.

## Docker / multi-container

`docker compose up --build` avvia:
- `postgres`
- `app` (backend NestJS)
- `pdf-service` (Pandoc + TeX Live)
- `frontend` (Vite build servito da Nginx)

Nel compose, `app` usa sempre `PDF_SERVICE_URL=http://pdf-service:3100`.
Nel compose corrente, `ENABLE_LOCAL_PDF_FALLBACK=false` per evitare fallback implicito nel container app.

## Comandi principali

Backend:

```bash
npm run build
npm run start
npm run start:dev
npm run test
npm run check
npm run typeorm -- migration:run
```

Frontend:

```bash
cd frontend
npm run build
npm run dev
```

## Note Pandoc/LaTeX

- Modalita locale: backend invoca `PANDOC_PATH` (solo fallback sviluppo/test).
- Modalita service: backend delega al servizio HTTP PDF (`PDF_SERVICE_URL`) ed e la modalita raccomandata in produzione.
- `Dockerfile.pdf` installa Pandoc e pacchetti TeX Live estesi per casi multilingua/font.

## Troubleshooting rapido

- Errore `Pandoc non trovato`: verificare `PANDOC_PATH` (fallback locale) oppure salute `pdf-service` su `/health`.
- Errore startup in produzione per `PDF_SERVICE_URL`: configurare URL del servizio PDF o correggere `NODE_ENV`.
- `fieldValues` non valido su `/api/templates/:id/pdf/latest`: la query deve contenere JSON valido e oggetto (`{...}`), altrimenti ritorna `400`.

## Coerenza documentazione

Questo README descrive solo endpoint, flussi e componenti presenti nel codice corrente. Non include API legacy (`/api/pdf`, `/api/dev`, `documents`) perché non esistono nel runtime attuale.
