require('dotenv').config();
const { execFile } = require('child_process');

const pandocPath = process.env.PANDOC_PATH || 'pandoc';
const pdfEngine = process.env.PANDOC_PDF_ENGINE || 'pdflatex';

execFile(pandocPath, ['--version'], (err, stdout) => {
  if (err) {
    console.error(`Pandoc non trovato da Node.`);
    console.error(`Comando provato: ${pandocPath}`);
    console.error(`Errore: ${err.message}`);
    console.error('');
    console.error('Soluzione: esegui "where pandoc" nel terminale dove pandoc funziona,');
    console.error('poi copia il percorso completo in .env, esempio:');
    console.error('PANDOC_PATH=C:\\Program Files\\Pandoc\\pandoc.exe');
    process.exit(1);
  }

  console.log(stdout.split(/\r?\n/)[0]);
  console.log(`Comando usato da Node: ${pandocPath}`);

  execFile(pdfEngine, ['--version'], (engineErr, engineStdout) => {
    if (engineErr) {
      console.error('');
      console.error('Motore PDF non trovato da Node.');
      console.error(`Comando provato: ${pdfEngine}`);
      console.error(`Errore: ${engineErr.message}`);
      process.exit(1);
    }

    console.log(engineStdout.split(/\r?\n/)[0]);
    console.log(`Motore PDF usato da Pandoc: ${pdfEngine}`);
  });
});
