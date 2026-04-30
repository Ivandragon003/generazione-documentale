# Database — MAC-Documents

## Struttura cartella

```
db/
├── schema.sql                          ← Schema finale (bootstrap ambienti nuovi)
├── migrations/
│   ├── 001_initial_schema.sql          ← Creazione tabelle base
│   ├── 002_add_content_path.sql        ← Aggiunta colonna content_path
│   └── 003_cleanup_legacy_columns.sql  ← Pulizia colonne/tabelle obsolete
├── seeds/
│   ├── 001_seed_sample.sql             ← Dati di esempio realistici (dev locale)
│   └── fixtures/
│       └── 001_dev_fixtures.sql        ← ⚠️ Solo dev/test — UUID fissi per i test
└── README.md                           ← Questo file
```

## Quando usare ogni file

| File | Quando eseguirlo |
|---|---|
| `schema.sql` | Setup iniziale di un ambiente vuoto (alternativa rapida alle migration) |
| `migrations/001_*` | Prima migration su ogni ambiente tramite `migrations/run.js` |
| `migrations/002_*` | Aggiornamento: aggiunge `content_path` |
| `migrations/003_*` | Aggiornamento: rimuove colonne legacy e marca job appesi |
| `seeds/001_seed_sample.sql` | Popola l'ambiente di sviluppo con dati verosimili |
| `seeds/fixtures/001_dev_fixtures.sql` | Reset completo per i test automatici — **cancella tutto** |

## Eseguire le migration

```bash
# Tutte le migration in ordine
node migrations/run.js

# Solo il seed di esempio (dopo le migration)
psql $DATABASE_URL -f db/seeds/001_seed_sample.sql

# Reset completo + fixture (solo dev/test)
psql $DATABASE_URL -f db/seeds/fixtures/001_dev_fixtures.sql
```

## ⚠️ Regole

- `seeds/fixtures/` → **mai in produzione**
- `schema.sql` → solo bootstrap, non modifica ambienti esistenti
- Ogni nuova modifica allo schema → nuova migration numerata in `migrations/`
- I file di migration sono **idempotenti** (`IF NOT EXISTS`, `IF EXISTS`)
