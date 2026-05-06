import { execFile } from "node:child_process";
import { config } from "dotenv";

config();

const pandocPath = process.env.PANDOC_PATH ?? "pandoc";
const pdfEngine =
  process.env.PDF_ENGINE ?? process.env.PANDOC_PDF_ENGINE ?? "xelatex";

execFile(pandocPath, ["--version"], (pandocError, pandocOutput) => {
  if (pandocError) {
    // eslint-disable-next-line no-console
    console.error("Pandoc non trovato da Node.");
    // eslint-disable-next-line no-console
    console.error(`Comando provato: ${pandocPath}`);
    // eslint-disable-next-line no-console
    console.error(`Errore: ${pandocError.message}`);
    process.exit(1);
  }

  // eslint-disable-next-line no-console
  console.log((pandocOutput.split(/\r?\n/)[0] ?? "").trim());
  // eslint-disable-next-line no-console
  console.log(`Comando usato da Node: ${pandocPath}`);

  execFile(pdfEngine, ["--version"], (engineError, engineOutput) => {
    if (engineError) {
      // eslint-disable-next-line no-console
      console.error("Motore PDF non trovato da Node.");
      // eslint-disable-next-line no-console
      console.error(`Comando provato: ${pdfEngine}`);
      // eslint-disable-next-line no-console
      console.error(`Errore: ${engineError.message}`);
      process.exit(1);
    }

    // eslint-disable-next-line no-console
    console.log((engineOutput.split(/\r?\n/)[0] ?? "").trim());
    // eslint-disable-next-line no-console
    console.log(`Motore PDF usato da Pandoc: ${pdfEngine}`);
  });
});
