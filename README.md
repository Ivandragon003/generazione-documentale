# MAC Documents Backend

Enterprise backend for managing Markdown document templates and controlled PDF/DOCX generation. The service exposes NestJS-based REST APIs, stores metadata in PostgreSQL, reads templates from GitHub, and delegates document conversion to a dedicated Pandoc/LaTeX service or, in development, to a local fallback.

## Service objective

MAC Documents Backend centralizes the document template lifecycle:

- cataloging and updating Markdown templates;
- syntax validation and Markdown content safety checks;
- placeholder and fillable field normalization;
- asynchronous PDF generation through tracked jobs;
- synchronous DOCX generation;
- download of the latest completed PDF for a given set of filled values;
- OpenAPI documentation exposure for internal integrations.

## Technical stack

- Runtime: Node.js 22+
- Framework: NestJS 11
- Language: TypeScript
- Database: PostgreSQL 16
- ORM: TypeORM
- API documentation: Swagger/OpenAPI
- Code quality: Biome
- Testing: Jest
- Document rendering: Pandoc + LaTeX, via remote service or local fallback
- Containerization: Docker and Docker Compose

## Architecture

```text
Client / Frontend
      |
      v
NestJS API Backend
      |
      +-- PostgreSQL
      |      - template metadata
      |      - PDF jobs
      |
      +-- GitHub repository
      |      - Markdown template sources
      |
      +-- PDF service
             - Pandoc
             - LaTeX
             - PDF/DOCX output
```

Main components:

- `src/controller/`: HTTP controllers and API contracts.
- `src/service/`: application logic for templates, rendering, and PDF jobs.
- `src/repository/`: access to persisted data.
- `src/entities/`: TypeORM entities.
- `src/dto/`: API input validation.
- `src/config/`: runtime configuration, database, PDF, and environment validation.
- `src/common/`: filters, mappers, utilities, and shared types.
- `scripts/pdf-service.mjs`: standalone Pandoc/LaTeX service used by the PDF container.
- `test/`: unit and light integration tests.

## Operational flow

1. Markdown templates are versioned in a GitHub repository configured through `GITHUB_*` variables.
2. The backend reads templates, validates content, and normalizes placeholders.
3. Application metadata is stored in PostgreSQL.
4. The client sends field values to generate a document.
5. For PDF generation, the backend creates an asynchronous job and tracks its status.
6. The worker renders compiled Markdown and sends conversion to the PDF service.
7. The client monitors the job and downloads the document when status is `completed`.
8. For DOCX generation, the backend generates and returns the file in the same request.

## Available APIs

Interactive documentation is available at:

```text
GET /api-docs
```

Health check:

```text
GET /health
```

Templates:

```text
GET    /api/templates
POST   /api/templates
PUT    /api/templates/:id
DELETE /api/templates/:id
POST   /api/templates/validate
POST   /api/templates/audit
POST   /api/templates/generate-draft
```

Document generation:

```text
POST /api/templates/:id/pdf
POST /api/templates/:id/docx
GET  /api/templates/:id/pdf/jobs
GET  /api/templates/:id/pdf/jobs/:jobId
GET  /api/templates/:id/pdf/latest
```

Operational notes:

- Endpoints under `/api/templates` accept template identifiers in the service format, including normalized GitHub paths.
- Optional `x-user` header is used to track the actor on supported operations.
- `fieldValues` must be a JSON object.
- `/api/templates/:id/pdf/latest` accepts `fieldValues` as a valid JSON query string.

## Configuration

Create a `.env` file starting from `.env.example`:

```bash
cp .env.example .env
```

Required backend variables:

```text
NODE_ENV
PORT
DB_HOST
DB_PORT
DB_USER
DB_PASSWORD
DB_NAME
GITHUB_TOKEN
GITHUB_OWNER
GITHUB_REPO
GITHUB_BRANCH
GITHUB_TEMPLATES_DIR
```

Relevant variables for document generation:

```text
PDF_SERVICE_URL
ENABLE_LOCAL_PDF_FALLBACK
PANDOC_PATH
PDF_ENGINE
PDF_GENERATION_RETRIES
PDF_GENERATION_RETRY_DELAY_MS
PDF_GENERATION_TIMEOUT_MS
PDF_QUEUE_RECOVERY_RETRY_MS
AUDIT_LOG_RETENTION_DAYS
MAX_TEMPLATE_CONTENT_BYTES
MAX_PDF_MARKDOWN_BYTES
STORAGE_PATH
AI_PROVIDER
OLLAMA_BASE_URL
OLLAMA_MODEL
```

AI semantic audit mode:

- `AI_PROVIDER=mock`: deterministic semantic mock provider (recommended for CI/tests).
- `AI_PROVIDER=ollama`: local LLM semantic review through Ollama HTTP API.
- `AI_AUDIT_DEBUG=true`: optional backend logs for provider/model/latency/errors.
- `AI_AUDIT_MIN_CONFIDENCE=0.60`: minimum confidence threshold to keep AI warnings.
- `AI_AUDIT_CACHE_TTL_MS=300000`: in-memory cache TTL (ms) for Ollama audits by template hash.

To run local Ollama with the default model used by this project:

```bash
ollama pull qwen2.5:7b
```

Suggested `.env` for local Ollama:

```text
AI_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5:7b
OLLAMA_DRAFT_NUM_PREDICT=500
OLLAMA_AUDIT_NUM_PREDICT=350
OLLAMA_KEEP_ALIVE=10m
OLLAMA_REQUEST_TIMEOUT_MS=420000
OLLAMA_REQUEST_RETRIES=1
AI_AUDIT_DEBUG=false
AI_AUDIT_MIN_CONFIDENCE=0.60
AI_AUDIT_CACHE_TTL_MS=300000
```

This project supports only `qwen2.5:7b` for:
- guided template generation;
- semantic review;
- AI benchmark runs.

Practical local usage tips for `qwen2.5:7b`:
- keep `OLLAMA_DRAFT_NUM_PREDICT` moderate (for example `500`);
- keep prompt descriptions focused and avoid unnecessary complexity;
- keep `OLLAMA_KEEP_ALIVE=10m` enabled to reduce cold starts;
- use an adequate `OLLAMA_REQUEST_TIMEOUT_MS` on consumer hardware;
- local generation can be slow on consumer-grade CPUs/GPUs.

If backend runs in Docker and Ollama runs on host machine, use:

```text
OLLAMA_BASE_URL=http://host.docker.internal:11434
```

`AUDIT_LOG_RETENTION_DAYS` default: `180`. Values `0` or negative disable retention. Audit cleanup runs periodically on the backend and removes only `audit_logs` rows older than the configured cutoff.

The template filesystem cache is a tenant-scoped mirror used for GitHub synchronization support: each local file has a `.sha256` checksum sidecar. If the sidecar is missing, local content is treated as non-verifiable cache: the local mirror is invalidated and reads return cache miss. If checksum does not match, the cache is treated as corrupted/inconsistent: the local mirror is invalidated and the caller must re-sync from GitHub as source of truth. An application error should be returned only in flows that explicitly require cache and cannot re-sync from GitHub.

PDF layout variables:

```text
PDF_PAPER
PDF_FONT_SIZE
PDF_MARGIN_TOP
PDF_MARGIN_BOTTOM
PDF_MARGIN_LEFT
PDF_MARGIN_RIGHT
PDF_MAIN_FONT
PDF_SANS_FONT
PDF_MONO_FONT
PDF_LINE_STRETCH
PDF_COLOR_LINKS
PDF_LINK_COLOR
```

In production, `PDF_SERVICE_URL` is required. If missing, the application fails at startup to prevent uncontrolled document generation.

## Local startup

Prerequisites:

- Node.js 22 or newer
- reachable PostgreSQL instance
- GitHub token with access to the template repository
- Pandoc and LaTeX installed only if local fallback is used

Installation:

```bash
npm install
```

Development start:

```bash
npm run start:dev
```

Build:

```bash
npm run build
```

Start built app:

```bash
npm run start:prod
```

Verify local Pandoc toolchain:

```bash
npm run check:pandoc
```

## Startup with Docker Compose

Compose starts the full application stack:

- `postgres`: PostgreSQL database;
- `app`: NestJS backend;
- `pdf-service`: separate Pandoc/LaTeX service;
- `frontend`: React frontend served by Nginx.

Command:

```bash
docker compose up --build
```

Default local endpoints:

```text
Backend:  http://localhost:3000
Swagger:  http://localhost:3000/api-docs
Health:   http://localhost:3000/health
Frontend: http://localhost:4173
```

In compose, backend uses `PDF_SERVICE_URL=http://pdf-service:3100` and stores generated PDFs in `mac_pdf_storage` volume.

## Database

The backend uses TypeORM with PostgreSQL. Main commands:

```bash
npm run typeorm -- migration:run
npm run migration:generate
npm run migration:revert
```

In enterprise environments, it is recommended to use versioned migrations and disable automatic schema synchronization when not explicitly needed.

## Quality and tests

Static checks:

```bash
npm run check
```

Automatic fixes where supported:

```bash
npm run fix
```

Tests:

```bash
npm run test
```

Template-draft benchmark (AI generation + deterministic validation):

```bash
npm run benchmark:template-drafts
```

Deterministic template benchmark baseline:

```bash
npm run benchmark:templates
```

Local thesis dataset (not versioned in Git):

- Set `DATASET_PATH` to your local thesis dataset directory.
- `test:dataset` and `generate:dataset` require `DATASET_PATH`.
- If the configured path does not exist, scripts fail with:
  `DATASET_PATH non configurato. Imposta DATASET_PATH per eseguire i test sul dataset tesi.`

Examples:

```bash
DATASET_PATH=thesis-dataset npm run test:dataset
DATASET_PATH=thesis-dataset npm run generate:dataset
DATASET_PATH=thesis-dataset npm run eval:ai
```

PowerShell:

```powershell
$env:DATASET_PATH="thesis-dataset"
npm run generate:dataset
```

Template AI audit quick test:

```bash
curl -X POST http://localhost:3000/api/templates/audit \
  -H "Content-Type: application/json" \
  -d '{
    "runAi": true,
    "content": "| Campo | Valore |\n|---|---|\n| Data di nascita | {{string:data_nascita}} |\n| Importo totale | {{string:importo_totale}} |\n| Nome cliente | {{string:nome_cliente}} |"
  }'
```

Template AI draft generation quick test:

```bash
curl -X POST http://localhost:3000/api/templates/generate-draft \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Verbale riunione con data, partecipanti e decisioni",
    "language": "it",
    "runSemanticAudit": false
  }'
```

Suites cover DTO validation, environment configuration, document rendering, Markdown safety, template controller behavior, PDF jobs, and PDF configuration.

## Application security

The backend includes defensive controls for:

- DTO validation with global whitelist;
- consistent exception handling;
- size limits for templates and generated Markdown;
- placeholder validation;
- blocking risky Markdown/LaTeX patterns;
- production fail-fast when PDF service is not configured;
- PDF rendering isolation in a dedicated service.

The repository must not contain real tokens or operational credentials. Use local `.env`, secret managers, or platform-managed environment variables.

## PDF modes

Remote mode, recommended for production:

- configure `PDF_SERVICE_URL`;
- backend checks PDF service `/health` at startup;
- conversion runs outside NestJS process.

Local mode, for development or controlled testing only:

- leave `PDF_SERVICE_URL` empty;
- set `ENABLE_LOCAL_PDF_FALLBACK=true`;
- configure `PANDOC_PATH` if Pandoc is not in `PATH`.

## Future PDF profile strategy

To keep the SaaS service reproducible without runtime installs, the PDF code uses logical language profile classification:

- `latin`: LTR European languages (default)
- `rtl`: `ar`, `he`, `fa`, `ur`
- `cjk`: `ja`, `zh`, `ko`

Recommended evolution (without API changes):

- `pdf-service-latin`
- `pdf-service-rtl`
- `pdf-service-cjk`
- `pdf-service-full`

Each image should be prebuilt with required packages/fonts and published in the registry. Profile routing can be added later at orchestration level (compose/k8s), keeping endpoints and template placeholders unchanged.

## PDF language flow (clarification)

- The language passed in PDF jobs is used only to choose script/font/direction profile (`latin`/`rtl`/`cjk`); it does not translate or alter template content.
- Frontend: by default sends `navigator.language` in PDF/DOCX requests.
- Backend: normalizes language (for example `it-IT` -> `it`) and maps profiles:
  - `ar`/`he`/`fa`/`ur` -> `rtl`
  - `ja`/`zh`/`ko` -> `cjk`
  - all other languages -> `latin`
- Language is persisted in `pdf_jobs.language` to guarantee repeatable asynchronous worker execution (same input -> same rendering profile).
- Template filesystem cache does not decide language and has no responsibility for language-aware rendering: it remains a template mirror.
- `navigator.language` is only a client-side default; in the future it can be replaced by an explicit language selected at template/document level, without changing persisted-job principles.

## Troubleshooting

`Missing required environment variable: PDF_SERVICE_URL`

- In production, configure `PDF_SERVICE_URL`.
- In development, use `ENABLE_LOCAL_PDF_FALLBACK=true` only if Pandoc/LaTeX are installed locally.

`Pandoc not found`

- Verify `PANDOC_PATH`.
- Run `npm run check:pandoc`.
- In Docker, verify `pdf-service` container status.

`fieldValues must be an object`

- Send a JSON object, for example:

```json
{
  "fieldValues": {
    "cliente": "ACME S.p.A.",
    "importo": 1200
  }
}
```

PDF jobs unavailable after Docker cleanup:

- Jobs are persisted in PostgreSQL.
- PDF files are in `mac_pdf_storage` volume.
- `docker compose down -v` removes volumes and therefore persisted data.

## Notes for enterprise environments

For stable deployments, it is recommended to:

- use `NODE_ENV=production`;
- always configure `PDF_SERVICE_URL`;
- protect `GITHUB_TOKEN` via secret manager;
- apply backup and retention to PostgreSQL and PDF storage;
- run migrations in a controlled pipeline;
- expose `/api-docs` only on authorized networks or environments;
- monitor health checks, application logs, and PDF job status;
- maintain the GitHub template repository with review and versioning.

## Relevant files

```text
README.md
.env.example
package.json
docker-compose.yml
Dockerfile
Dockerfile.pdf
src/main.ts
src/controller/templates.controller.ts
src/service/pdf-generation.service.ts
src/service/pdf-jobs.service.ts
src/service/templates.service.ts
src/config/env.validation.ts
src/config/pdf.config.ts
```

## Documentation status

This README describes the backend currently present in the codebase. It does not document legacy endpoints or modules not included in the current runtime.

