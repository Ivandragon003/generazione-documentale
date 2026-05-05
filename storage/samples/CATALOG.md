# Catalogo sample Markdown

Ultimo aggiornamento: 2026-05-05

Questa cartella contiene file di esempio per upload e validazione.
Questi file non sono template applicativi attivi finche non vengono importati tramite API.

## File

| File | Scopo | Stato |
|---|---|---|
| `template-upload-valido.md` | Template Markdown complesso valido per test upload e generazione PDF | valido |
| `corrotto.md` | Esempio intenzionalmente non valido per test di validazione negativa | corrotto intenzionale |

## Regole operative

- Non usare questa cartella come archivio dei template creati dall'applicazione.
- I template applicativi versionati stanno in `storage/templates`.
- I PDF generati stanno in `storage/pdf`.
- Se un sample viene importato e diventa template reale, il riferimento ufficiale diventa il record DB e il file copiato in `storage/templates/<templateId>/vN.md`.
