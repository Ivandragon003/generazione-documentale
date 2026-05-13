# MAC Documents Frontend

React + Vite UI collegata alle API backend correnti.

## Funzioni

- lista template letti da GitHub;
- editor Markdown del template;
- documento HTML dinamico con controlli inline al posto dei placeholder;
- generazione, polling e download PDF.

Il frontend non usa API `documents`, `/api/pdf` o `/api/dev`.

## Rendering campi

`{{nome_cliente}}` diventa un input testuale nel documento.
`{{data:date}}` diventa un input date.
`{{totale:number}}` diventa un input number.
`{{accettato:boolean}}` diventa una checkbox.
`{{righe:table}}` diventa una tabella editabile quando il campo ha `columns`.

## Comandi

```bash
npm install
npm run build
npm run dev
```
