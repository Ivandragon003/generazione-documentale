# MAC Frontend Prototype

Interfaccia React + TypeScript + MUI per il sistema **MAC (Management As Code)** — modulo di generazione documentale.

## Stack

- React 19 + Vite + TypeScript
- Material UI v7
- react-markdown per anteprima

## Avvio

```bash
cd frontend
npm install
npm run dev
# visita http://localhost:4173
```

## Variabili d'ambiente

Copia `.env.example` in `.env.local` e imposta:

```
VITE_API_URL=http://localhost:3000
```

## Struttura

```
frontend/
├── src/
│   ├── App.tsx                  # Shell principale con tab
│   ├── styles.css               # Stili globali
│   ├── main.tsx                 # Entry point + MUI theme
│   ├── components/
│   │   ├── HeaderBar.tsx        # Header documento
│   │   ├── TemplateEditor.tsx   # Editor markdown + rilevamento placeholder
│   │   ├── FieldsPanel.tsx      # Compilazione campi dinamici
│   │   └── PdfPreview.tsx       # Anteprima PDF renderizzata
│   ├── data/
│   │   ├── mock.ts              # Dati mock iniziali (Project Charter)
│   │   └── api.ts               # Servizi REST verso NestJS backend
│   └── utils/
│       └── template.ts          # Logica placeholder (estrazione, diff, render)
```

## Endpoint collegati

| Metodo | Endpoint | Descrizione |
|--------|----------|-------------|
| GET | `/templates` | Lista template |
| GET | `/templates/:id` | Dettaglio template |
| POST | `/templates` | Crea nuovo template |
| PATCH | `/templates/:id` | Aggiorna template (stessa struttura placeholder) |
| GET | `/documents` | Lista documenti |
| GET | `/documents/:id` | Dettaglio documento |
| POST | `/documents` | Crea documento da template |
| PATCH | `/documents/:id/field-values` | Aggiorna solo i valori dei campi |
| PATCH | `/documents/:id/status` | Cambia stato documento |
| POST | `/pdf-jobs` | Avvia generazione PDF |
| GET | `/pdf-jobs/:id` | Stato del job PDF |
| GET | `/pdf-jobs?document_id=:id` | Jobs PDF di un documento |

## Logica Template vs Documento

- **Modifichi solo i valori** → `PATCH /documents/:id/field-values` (content invariato)
- **Modifichi i placeholder nel markdown** → il frontend rileverà il diff e proporrà di creare un nuovo template (`POST /templates`)
- **Modifichi solo testo** → `PATCH /templates/:id`
