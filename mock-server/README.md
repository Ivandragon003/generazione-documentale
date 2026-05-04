# MAC Documents — Mock Server

Server mock generato automaticamente da Swagger Codegen a partire dall'`openapi.yaml`.

## Avvio

```bash
cd mock-server
npm install
npm start
# → http://localhost:8080
# → Swagger UI: http://localhost:8080/docs
```

## Struttura

```
mock-server/
├── index.js              # Entry point (porta 8080)
├── api/
│   └── openapi.yaml      # Spec OpenAPI
├── controllers/          # Routing automatico (oas3-tools)
│   ├── Audit.js
│   ├── Dev.js
│   ├── Documents.js
│   ├── Health.js
│   ├── Pdf.js
│   └── Templates.js
├── service/              # Logica (da implementare)
│   ├── AuditService.js
│   ├── DevService.js
│   ├── DocumentsService.js
│   ├── HealthService.js
│   ├── PdfService.js
│   └── TemplatesService.js
└── utils/
    └── writer.js
```

## Integrazione con il NestJS

Per puntare il client TypeScript al NestJS reale invece del mock:

```ts
const config: Configuration = { basePath: 'http://localhost:3000' };
```
