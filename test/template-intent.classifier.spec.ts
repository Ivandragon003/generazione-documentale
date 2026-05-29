import { TemplateIntentClassifier } from "../src/service/template-intent.classifier";

describe("TemplateIntentClassifier", () => {
  const classifier = new TemplateIntentClassifier();

  it.each([
    ["Fammi un Project Charter", "project_charter", "project_management"],
    ["Genera un verbale tecnico", "verbale", "tecnico"],
    ["Mi serve un report economico", "report", "economico"],
    ["Crea una scheda assicurativa", "scheda", "assicurativo"],
    ["Fammi una checklist operativa", "checklist", "generico"],
    ["Genera un piano di progetto", "project_plan", "project_management"],
    ["Crea un capitolato tecnico", "capitolato", "tecnico"],
    ["Fammi un documento amministrativo", "procedure", "amministrativo"],
    [
      "Crea un template generico per una procedura interna",
      "procedure",
      "generico",
    ],
  ])("infers type/domain for short prompt: %s", (prompt, expectedArchetype, expectedDomain) => {
    const inferred = classifier.infer(prompt);
    expect(inferred.archetype).toBe(expectedArchetype);
    expect(inferred.domain).toBe(expectedDomain);
  });

  it("falls back to generic template for unknown requests", () => {
    const inferred = classifier.infer("Fammi un modello documento");
    expect(inferred.archetype).toBe("generic_template");
  });
});
