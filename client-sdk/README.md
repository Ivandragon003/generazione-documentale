# MAC Documents API — TypeScript Client SDK

Client TypeScript auto-generato da Swagger Codegen, aggiornato manualmente per correggere il `basePath`.

## Installazione dipendenze

```bash
npm install isomorphic-fetch
npm install --save-dev @types/isomorphic-fetch
```

## Utilizzo

```ts
import { Configuration, HealthApi, DocumentsApi, TemplatesApi } from './client-sdk';

// Punta al mock server
const config = new Configuration({ basePath: 'http://localhost:8080' });

// Oppure punta direttamente al NestJS
// const config = new Configuration({ basePath: 'http://localhost:3000' });

const health = new HealthApi(config);
health.healthControllerCheck().then(console.log);
// → { status: 'ok', timestamp: '...' }

const docs = new DocumentsApi(config);
docs.documentsControllerFindAll().then(console.log);
```

## File

| File | Descrizione |
|---|---|
| `api.ts` | Classi API per tutti gli endpoint |
| `configuration.ts` | Configurazione con `basePath` |
| `index.ts` | Re-export di tutto il SDK |
