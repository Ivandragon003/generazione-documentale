# MAC Documents

Backend NestJS + frontend React per lavorare su template Markdown salvati su GitHub, compilare i placeholder direttamente nel documento e generare PDF.

## Flusso

1. I template vengono letti solo da GitHub (`GITHUB_OWNER`, `GITHUB_REPO`, `GITHUB_TEMPLATES_DIR`).
2. Il frontend renderizza il Markdown in HTML controllato.
3. I placeholder `{{nome}}` o `{{nome:tipo}}` diventano controlli inline.
4. I valori compilati vengono inviati a `POST /api/templates/:id/pdf`.
5. Il backend genera il PDF localmente con Pandoc oppure tramite `PDF_SERVICE_URL`.

## API esposte

| Metodo | Path | Uso |
| --- | --- | --- |
| `GET` | `/health` | Health check |
| `GET` | `/api/templates` | Lista template presenti su GitHub |
| `POST` | `/api/templates` | Crea template su GitHub |
| `GET` | `/api/templates/:id` | Dettaglio template |
| `PUT` | `/api/templates/:id` | Aggiorna template |
| `DELETE` | `/api/templates/:id` | Elimina template |
| `POST` | `/api/templates/validate` | Valida Markdown e placeholder |
| `POST` | `/api/templates/:id/pdf` | Accoda generazione PDF |
| `GET` | `/api/templates/:id/pdf/jobs` | Lista job PDF del template |
| `GET` | `/api/templates/:id/pdf/jobs/:jobId` | Stato job PDF |
| `GET` | `/api/templates/:id/pdf/jobs/:jobId/download` | Scarica PDF del job |
| `GET` | `/api/templates/:id/pdf/latest` | Scarica ultimo PDF completato |

Non sono esposte API `documents`, `/api/pdf` o `/api/dev`.

## Campi dinamici

Tipi supportati:

`text`, `textarea`, `number`, `date`, `boolean`, `checkbox`, `email`, `url`, `tel`, `select`, `currency`, `table`, `subtable`, `list`, `repeater`.

Sintassi inline:

```md
# Offerta per {{nome_cliente:text}}

Data: {{data_offerta:date}}
Totale: {{totale:number}}
Accettata: {{accettata:boolean}}

{{righe:table}}
```

Le definizioni complete possono essere passate nel campo `fields`, con `options` per select e `columns` per tabelle, subtabelle e repeater.

## PDF service separato

Docker Compose avvia:

- `app`: backend NestJS leggero, senza LaTeX/Pandoc.
- `pdf-service`: container separato con Pandoc e TeX Live.
- `frontend`: build Vite servita da Nginx.
- `postgres`: database.

L'app parla col servizio PDF tramite:

```env
PDF_SERVICE_URL=http://pdf-service:3100
```

Se `PDF_SERVICE_URL` non e impostato, il backend usa `PANDOC_PATH` locale.

## Comandi

Backend:

```bash
npm install
npm run build
npm test -- --runInBand
npm run start:dev
```

Frontend:

```bash
cd frontend
npm install
npm run build
npm run dev
```

Docker:

```bash
docker compose up --build
```
