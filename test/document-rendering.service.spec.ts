import { DocumentRenderingService } from "../src/service/document-rendering.service";

describe("DocumentRenderingService", () => {
  const service = new DocumentRenderingService();

  it("renderizza valori scalari, booleani, tabelle e tabelle annidate", () => {
    const content = [
      "# {{titolo}}",
      "Attivo: {{attivo}}",
      "Data: {{data}}",
      "{{righe:table}}",
    ].join("\n\n");

    const result = service.renderTemplate(
      content,
      {
        titolo: "Documento compilato",
        attivo: true,
        data: "2026-05-13",
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
    expect(result.result).toContain("Si");
    expect(result.result).toContain("2026-05-13");
    expect(result.result).toContain("| descrizione | quantita | dettagli |");
    expect(result.result).toContain("Analisi");
    expect(result.result).not.toContain("{{");
  });
});
