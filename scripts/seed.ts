import "reflect-metadata";
import { config } from "dotenv";
import { DataSource } from "typeorm";
import { CategoryEntity, type CategoryType } from "../src/entities/category.entity";
import { SectionEntity } from "../src/entities/section.entity";
import { TemplateEntity } from "../src/entities/template.entity";
import { DocumentEntity } from "../src/entities/document.entity";
import { PdfJobEntity } from "../src/entities/pdf-job.entity";
import type { FieldDefinition } from "../src/common/types/field-definition.type";
import { parsePort } from "../src/common/utils/parse-port";

config();

const dataSource = new DataSource({
  type: "postgres",
  host: process.env.DB_HOST ?? "localhost",
  port: parsePort(process.env.DB_PORT ?? "5432"),
  username: process.env.DB_USER ?? "postgres",
  password: process.env.DB_PASSWORD ?? "postgres",
  database: process.env.DB_NAME ?? "mac_documents",
  entities: [CategoryEntity, SectionEntity, TemplateEntity, DocumentEntity, PdfJobEntity],
  synchronize: false,
});

// ═══════════════════════════════════════════════════════════════════
// CATEGORIES
// ═══════════════════════════════════════════════════════════════════
const CATEGORIES: { id: string; type: CategoryType; name: string }[] = [
  { id: "11111111-1111-4111-8111-111111111111", type: "portfolio", name: "Portfolio" },
  { id: "22222222-2222-4222-8222-222222222222", type: "programma", name: "Programma" },
  { id: "33333333-3333-4333-8333-333333333333", type: "progetto",  name: "Progetto"  },
];

// ═══════════════════════════════════════════════════════════════════
// SECTIONS
// ═══════════════════════════════════════════════════════════════════
const SECTIONS = [
  // Portfolio
  { id: "aa000001-aaaa-4aaa-8aaa-aaaaaaaaaaaa", categoryId: "11111111-1111-4111-8111-111111111111", name: "Presentazione aziendale", position: 0 },
  { id: "aa000002-aaaa-4aaa-8aaa-aaaaaaaaaaaa", categoryId: "11111111-1111-4111-8111-111111111111", name: "Offerte commerciali",      position: 1 },
  // Programma
  { id: "bb000001-bbbb-4bbb-8bbb-bbbbbbbbbbbb", categoryId: "22222222-2222-4222-8222-222222222222", name: "Pianificazione",           position: 0 },
  { id: "bb000002-bbbb-4bbb-8bbb-bbbbbbbbbbbb", categoryId: "22222222-2222-4222-8222-222222222222", name: "Reportistica",             position: 1 },
  // Progetto
  { id: "cc000001-cccc-4ccc-8ccc-cccccccccccc", categoryId: "33333333-3333-4333-8333-333333333333", name: "Avvio progetto",           position: 0 },
  { id: "cc000002-cccc-4ccc-8ccc-cccccccccccc", categoryId: "33333333-3333-4333-8333-333333333333", name: "Gestione",                 position: 1 },
  { id: "cc000003-cccc-4ccc-8ccc-cccccccccccc", categoryId: "33333333-3333-4333-8333-333333333333", name: "Chiusura",                 position: 2 },
];

// ═══════════════════════════════════════════════════════════════════
// FIELDS
// ═══════════════════════════════════════════════════════════════════

const f = (name: string, label: string, type: FieldDefinition["type"], required = true, defaultValue = ""): FieldDefinition =>
  ({ name, label, type, required, defaultValue });

// ── Portfolio / Presentazione aziendale ────────────────────────────
const FIELDS_LETTERA_PRESENTAZIONE: FieldDefinition[] = [
  f("mittente_nome",  "Nome mittente",        "text"),
  f("mittente_email", "Email mittente",        "email"),
  f("destinatario",   "Destinatario",          "text"),
  f("oggetto",        "Oggetto",               "text"),
  f("corpo",          "Testo della lettera",   "textarea"),
  f("data_lettera",   "Data",                  "date", false),
];

const FIELDS_PROFILO_AZIENDALE: FieldDefinition[] = [
  f("ragione_sociale", "Ragione sociale",      "text"),
  f("settore",         "Settore di attività",  "text"),
  f("anno_fondazione", "Anno di fondazione",   "number"),
  f("dipendenti",      "N° dipendenti",        "number", false),
  f("sito_web",        "Sito web",             "url",    false),
  f("email_contatto",  "Email di contatto",    "email"),
  f("telefono",        "Telefono",             "tel",    false),
  f("descrizione",     "Descrizione azienda",  "textarea"),
];

// ── Portfolio / Offerte commerciali ────────────────────────────────
const FIELDS_OFFERTA_STANDARD: FieldDefinition[] = [
  f("numero_offerta",  "N° offerta",           "text"),
  f("cliente",         "Cliente",              "text"),
  f("email_cliente",   "Email cliente",        "email"),
  f("data_offerta",    "Data offerta",         "date"),
  f("validita_giorni", "Validità (giorni)",    "number", false, "30"),
  f("oggetto",         "Oggetto offerta",      "text"),
  f("descrizione",     "Descrizione servizi",  "textarea"),
  f("importo",         "Importo totale (€)",   "currency"),
  f("iva",             "IVA (%)",              "number", false, "22"),
  f("note",            "Note",                 "textarea", false),
];

const FIELDS_PREVENTIVO: FieldDefinition[] = [
  f("numero_preventivo", "N° preventivo",      "text"),
  f("cliente",           "Cliente",            "text"),
  f("email_cliente",     "Email cliente",      "email"),
  f("telefono_cliente",  "Telefono cliente",   "tel", false),
  f("data_emissione",    "Data emissione",     "date"),
  f("data_scadenza",     "Data scadenza",      "date", false),
  f("oggetto",           "Oggetto",            "text"),
  f("voci",              "Voci di costo",      "textarea"),
  f("imponibile",        "Imponibile (€)",     "currency"),
  f("iva_perc",          "Aliquota IVA (%)",   "number", false, "22"),
  f("totale",            "Totale IVA inclusa (€)", "currency"),
  f("condizioni",        "Condizioni di pagamento", "textarea", false),
];

// ── Programma / Pianificazione ─────────────────────────────────────
const FIELDS_PIANO_OPERATIVO: FieldDefinition[] = [
  f("titolo",           "Titolo piano",        "text"),
  f("responsabile",     "Responsabile",        "text"),
  f("anno_riferimento", "Anno di riferimento", "number"),
  f("obiettivo_gen",    "Obiettivo generale",  "textarea"),
  f("azioni",           "Azioni previste",     "textarea"),
  f("risorse",          "Risorse necessarie",  "textarea", false),
  f("budget",           "Budget (€)",          "currency", false),
  f("indicatori",       "Indicatori KPI",      "textarea", false),
  f("note",             "Note",                "textarea", false),
];

const FIELDS_CRONOPROGRAMMA: FieldDefinition[] = [
  f("titolo",       "Titolo attività",         "text"),
  f("responsabile", "Responsabile",            "text"),
  f("data_inizio",  "Data inizio",             "date"),
  f("data_fine",    "Data fine",               "date"),
  f("fasi",         "Fasi / milestone",        "textarea"),
  f("stato",        "Stato",                   "select", true, "pianificato,in corso,completato,sospeso"),
  f("note",         "Note",                    "textarea", false),
];

// ── Programma / Reportistica ───────────────────────────────────────
const FIELDS_REPORT_AVANZAMENTO: FieldDefinition[] = [
  f("titolo_report",   "Titolo report",        "text"),
  f("progetto_rif",    "Progetto di riferimento", "text"),
  f("responsabile",    "Responsabile",         "text"),
  f("periodo",         "Periodo di riferimento", "text"),
  f("attivita_svolte", "Attività svolte",      "textarea"),
  f("percentuale",     "Avanzamento (%)",      "number", false, "0"),
  f("criticita",       "Criticità rilevate",   "textarea", false),
  f("prossimi_step",   "Prossimi step",        "textarea", false),
  f("budget_consumato","Budget consumato (€)", "currency", false),
  f("budget_residuo",  "Budget residuo (€)",   "currency", false),
  f("note",            "Note",                 "textarea", false),
];

const FIELDS_VERBALE: FieldDefinition[] = [
  f("titolo",       "Oggetto riunione",        "text"),
  f("data",         "Data riunione",           "date"),
  f("luogo",        "Luogo / piattaforma",     "text", false),
  f("partecipanti", "Partecipanti",            "textarea"),
  f("discussione",  "Punti discussi",          "textarea"),
  f("delibere",     "Delibere e azioni",       "textarea"),
];

// ── Progetto / Avvio ───────────────────────────────────────────────
const FIELDS_SCHEDA_PROGETTO: FieldDefinition[] = [
  f("titolo_progetto",    "Titolo progetto",        "text"),
  f("responsabile",       "Responsabile",           "text"),
  f("email_responsabile", "Email responsabile",     "email"),
  f("cliente",            "Cliente",                "text"),
  f("sito_cliente",       "Sito web cliente",       "url",      false),
  f("telefono",           "Telefono di contatto",   "tel",      false),
  f("data_inizio",        "Data inizio",            "date"),
  f("data_fine",          "Data fine prevista",     "date"),
  f("budget",             "Budget totale (€)",      "currency"),
  f("costo_stimato",      "Costo stimato (€)",      "currency", false),
  f("priorita",           "Priorità",               "select",   true, "bassa,media,alta,critica"),
  f("stato",              "Stato progetto",         "select",   true, "pianificazione,in corso,in attesa,completato,annullato"),
  f("descrizione",        "Descrizione progetto",   "textarea"),
  f("obiettivi",          "Obiettivi principali",   "textarea", false),
  f("milestone",          "Milestone / fasi",       "textarea", false),
  f("note",               "Note aggiuntive",        "textarea", false),
  f("approvato",          "Approvato dal cliente",  "boolean",  false, "false"),
  f("numero_fattura",     "N° fattura collegata",   "number",   false),
];

const FIELDS_BRIEF_CREATIVO: FieldDefinition[] = [
  f("titolo",          "Titolo progetto",         "text"),
  f("cliente",         "Cliente",                 "text"),
  f("obiettivo",       "Obiettivo del progetto",  "textarea"),
  f("target",          "Target di riferimento",   "textarea"),
  f("tono",            "Tono di voce",            "select", false, "formale,informale,tecnico,creativo"),
  f("deliverable",     "Deliverable attesi",      "textarea"),
  f("scadenza",        "Scadenza",                "date"),
  f("budget",          "Budget indicativo (€)",   "currency", false),
];

// ── Progetto / Gestione ────────────────────────────────────────────
const FIELDS_REGISTRO_RISCHI: FieldDefinition[] = [
  f("titolo",          "Titolo documento",        "text"),
  f("progetto_rif",    "Progetto di riferimento", "text"),
  f("responsabile",    "Responsabile rischi",     "text"),
  f("data",            "Data rilevazione",        "date"),
  f("rischi",          "Rischi identificati",     "textarea"),
  f("probabilita",     "Probabilità media",       "select", false, "bassa,media,alta"),
  f("impatto",         "Impatto stimato",         "select", false, "basso,medio,alto"),
  f("azioni",          "Azioni di mitigazione",   "textarea"),
  f("stato",           "Stato gestione",          "select", false, "aperto,in gestione,chiuso"),
  f("note",            "Note",                    "textarea", false),
];

const FIELDS_PIANO_COMUNICAZIONE: FieldDefinition[] = [
  f("titolo",          "Titolo piano",            "text"),
  f("progetto_rif",    "Progetto di riferimento", "text"),
  f("responsabile",    "Responsabile comunicazione", "text"),
  f("stakeholder",     "Stakeholder coinvolti",   "textarea"),
  f("canali",          "Canali di comunicazione", "textarea"),
  f("frequenza",       "Frequenza aggiornamenti", "select", false, "giornaliera,settimanale,mensile,al bisogno"),
  f("formato",         "Formato report",          "text", false),
  f("email_distrib",   "Lista distribuzione",     "email", false),
  f("note",            "Note",                    "textarea", false),
];

// ── Progetto / Chiusura ────────────────────────────────────────────
const FIELDS_COLLAUDO: FieldDefinition[] = [
  f("titolo",          "Oggetto collaudo",        "text"),
  f("progetto_rif",    "Progetto di riferimento", "text"),
  f("data_collaudo",   "Data collaudo",           "date"),
  f("collaudatore",    "Collaudatore",            "text"),
  f("esito",           "Esito",                   "select", true, "positivo,positivo con riserve,negativo"),
  f("anomalie",        "Anomalie rilevate",       "textarea", false),
  f("azioni_correttive","Azioni correttive",      "textarea", false),
  f("accettato",       "Accettato dal cliente",   "boolean", false, "false"),
];

const FIELDS_CONSUNTIVO: FieldDefinition[] = [
  f("titolo",           "Titolo consuntivo",       "text"),
  f("progetto_rif",     "Progetto di riferimento", "text"),
  f("responsabile",     "Responsabile",            "text"),
  f("data_chiusura",    "Data chiusura",           "date"),
  f("budget_iniziale",  "Budget iniziale (€)",     "currency"),
  f("costo_finale",     "Costo finale (€)",        "currency"),
  f("scostamento",      "Scostamento (€)",         "currency", false),
  f("obiettivi_raggiunti", "Obiettivi raggiunti",  "textarea"),
  f("obiettivi_mancati",   "Obiettivi non raggiunti", "textarea", false),
  f("lezioni_apprese",  "Lezioni apprese",         "textarea", false),
  f("note",             "Note finali",             "textarea", false),
  f("chiuso",           "Progetto chiuso",         "boolean", false, "false"),
];

// ═══════════════════════════════════════════════════════════════════
// TEMPLATES
// ═══════════════════════════════════════════════════════════════════
const TEMPLATES: { id: string; sectionId: string; name: string; description: string; status: "draft" | "published"; fields: FieldDefinition[] }[] = [
  // Portfolio / Presentazione aziendale
  { id: "tpl00001-0000-4000-8000-000000000001", sectionId: "aa000001-aaaa-4aaa-8aaa-aaaaaaaaaaaa", name: "Lettera di presentazione", description: "Lettera formale di presentazione o accompagnamento",         status: "published", fields: FIELDS_LETTERA_PRESENTAZIONE },
  { id: "tpl00002-0000-4000-8000-000000000002", sectionId: "aa000001-aaaa-4aaa-8aaa-aaaaaaaaaaaa", name: "Profilo aziendale",         description: "Scheda sintetica di presentazione dell'azienda",           status: "published", fields: FIELDS_PROFILO_AZIENDALE },
  // Portfolio / Offerte commerciali
  { id: "tpl00003-0000-4000-8000-000000000003", sectionId: "aa000002-aaaa-4aaa-8aaa-aaaaaaaaaaaa", name: "Offerta commerciale standard", description: "Offerta commerciale con importo e condizioni base",       status: "published", fields: FIELDS_OFFERTA_STANDARD },
  { id: "tpl00004-0000-4000-8000-000000000004", sectionId: "aa000002-aaaa-4aaa-8aaa-aaaaaaaaaaaa", name: "Preventivo dettagliato",    description: "Preventivo con voci di costo, imponibile e IVA",          status: "published", fields: FIELDS_PREVENTIVO },
  // Programma / Pianificazione
  { id: "tpl00005-0000-4000-8000-000000000005", sectionId: "bb000001-bbbb-4bbb-8bbb-bbbbbbbbbbbb", name: "Piano operativo annuale",  description: "Pianificazione annuale con obiettivi, azioni e KPI",      status: "published", fields: FIELDS_PIANO_OPERATIVO },
  { id: "tpl00006-0000-4000-8000-000000000006", sectionId: "bb000001-bbbb-4bbb-8bbb-bbbbbbbbbbbb", name: "Cronoprogramma attività",  description: "Schedulazione temporale delle attività con milestone",    status: "published", fields: FIELDS_CRONOPROGRAMMA },
  // Programma / Reportistica
  { id: "tpl00007-0000-4000-8000-000000000007", sectionId: "bb000002-bbbb-4bbb-8bbb-bbbbbbbbbbbb", name: "Report avanzamento lavori", description: "Report periodico sullo stato avanzamento del progetto",  status: "published", fields: FIELDS_REPORT_AVANZAMENTO },
  { id: "tpl00008-0000-4000-8000-000000000008", sectionId: "bb000002-bbbb-4bbb-8bbb-bbbbbbbbbbbb", name: "Verbale di riunione",       description: "Verbale con partecipanti, punti discussi e delibere",     status: "published", fields: FIELDS_VERBALE },
  // Progetto / Avvio
  { id: "tpl00009-0000-4000-8000-000000000009", sectionId: "cc000001-cccc-4ccc-8ccc-cccccccccccc", name: "Scheda progetto completa",  description: "Anagrafica completa del progetto con budget e milestone", status: "published", fields: FIELDS_SCHEDA_PROGETTO },
  { id: "tpl00010-0000-4000-8000-000000000010", sectionId: "cc000001-cccc-4ccc-8ccc-cccccccccccc", name: "Brief creativo",            description: "Brief per progetti creativi: obiettivo, target, tono",   status: "published", fields: FIELDS_BRIEF_CREATIVO },
  // Progetto / Gestione
  { id: "tpl00011-0000-4000-8000-000000000011", sectionId: "cc000002-cccc-4ccc-8ccc-cccccccccccc", name: "Registro rischi",           description: "Identificazione e gestione dei rischi di progetto",       status: "published", fields: FIELDS_REGISTRO_RISCHI },
  { id: "tpl00012-0000-4000-8000-000000000012", sectionId: "cc000002-cccc-4ccc-8ccc-cccccccccccc", name: "Piano di comunicazione",   description: "Pianificazione delle comunicazioni verso gli stakeholder", status: "published", fields: FIELDS_PIANO_COMUNICAZIONE },
  // Progetto / Chiusura
  { id: "tpl00013-0000-4000-8000-000000000013", sectionId: "cc000003-cccc-4ccc-8ccc-cccccccccccc", name: "Collaudo e accettazione",   description: "Verbale di collaudo con esito e accettazione cliente",   status: "published", fields: FIELDS_COLLAUDO },
  { id: "tpl00014-0000-4000-8000-000000000014", sectionId: "cc000003-cccc-4ccc-8ccc-cccccccccccc", name: "Consuntivo finale",         description: "Consuntivo di chiusura con costi, risultati e lezioni",  status: "published", fields: FIELDS_CONSUNTIVO },
];

// ═══════════════════════════════════════════════════════════════════
// SEED
// ═══════════════════════════════════════════════════════════════════
const runSeed = async (): Promise<void> => {
  await dataSource.initialize();
  console.log("Connessione DB ok");

  const categoryRepo = dataSource.getRepository(CategoryEntity);
  const sectionRepo  = dataSource.getRepository(SectionEntity);
  const templateRepo = dataSource.getRepository(TemplateEntity);

  for (const cat of CATEGORIES) {
    await categoryRepo.upsert(cat, ["id"]);
    console.log(`  [cat] ${cat.name}`);
  }

  for (const sec of SECTIONS) {
    await sectionRepo.upsert(
      { id: sec.id, name: sec.name, position: sec.position, category: { id: sec.categoryId } },
      ["id"],
    );
    console.log(`    [sec] ${sec.name}`);
  }

  for (const tpl of TEMPLATES) {
    await templateRepo.upsert(
      {
        id:          tpl.id,
        name:        tpl.name,
        description: tpl.description,
        status:      tpl.status,
        fields:      tpl.fields,
        created_by:  "seed",
        section:     { id: tpl.sectionId },
      },
      ["id"],
    );
    console.log(`      [tpl] ${tpl.name} (${tpl.fields.length} campi)`);
  }

  console.log("\nSeed completato: 3 categorie · 7 sezioni · 14 template");
  await dataSource.destroy();
};

runSeed().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Errore seed");
  process.exit(1);
});
