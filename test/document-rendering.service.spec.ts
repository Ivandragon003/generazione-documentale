import { DocumentRenderingService } from "../src/service/document-rendering.service";

describe("DocumentRenderingService", () => {
  const service = new DocumentRenderingService();

  it("renderizza valori scalari, booleani, tabelle e tabelle annidate", () => {
    const content = [
      "# {{titolo}}",
      "Attivo: {{boolean:attivo}}",
      "Data: {{date:data}}",
      "Importo: {{currency:importo}}",
      "Avanzamento: {{percentage:avanzamento}}",
      "Punteggio: {{number:punteggio}}",
      "{{table:righe}}",
    ].join("\n\n");

    const result = service.renderTemplate(
      content,
      {
        titolo: "Documento compilato",
        attivo: true,
        data: "2026-05-13",
        importo: 1234.56,
        avanzamento: 12.5,
        punteggio: 87.75,
        righe: [
          {
            descrizione: "Setup",
            quantita: 2,
            dettagli: [{ voce: "Analisi", ore: 3 }],
          },
        ],
      },
      true,
    );

    expect(result.unresolved).toEqual([]);
    expect(result.result).toContain("Documento compilato");
    expect(result.result).toContain("Yes");
    expect(result.result).toContain("May 13, 2026");
    expect(result.result).toContain("1,234.56");
    expect(result.result).toContain("€");
    expect(result.result).toContain("12.5%");
    expect(result.result).toContain("87.75");
    expect(result.result).toContain("| descrizione | quantita | dettagli |");
    expect(result.result).toContain("Analisi");
    expect(result.result).not.toContain("{{");
  });
});
