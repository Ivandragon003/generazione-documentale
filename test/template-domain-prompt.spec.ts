import { buildTemplatePromptDescription } from "../src/service/prompt/template-prompt.builder";
import type { InferredGenerationIntent } from "../src/service/template-intent.classifier";
import { DOCUMENT_BLUEPRINTS } from "../src/service/template-profiles/document-type.profiles";
import { DOMAIN_PROFILES } from "../src/service/template-profiles/domain.profiles";

describe("buildTemplatePromptDescription domain-specific generation", () => {
  it("emits DOMAIN_SPECIFIC_GENERATION block when domain is specific and archetype is generic_template", () => {
    const intent: InferredGenerationIntent = {
      archetype: "generic_template",
      domain: "assicurativo",
      purpose: "structured_document",
      audience: ["stakeholder"],
      formality: "media",
      requiredSectionsFromPrompt: [],
      suggestedSections: [],
      suggestedFields: [],
    };

    const prompt = buildTemplatePromptDescription(
      "Vorrei un template per la gestione di un'agenzia assicurativa.",
      intent,
      DOCUMENT_BLUEPRINTS.generic_template,
      DOMAIN_PROFILES.assicurativo,
    );

    expect(prompt).toContain("[DOMAIN_SPECIFIC_GENERATION]");
    expect(prompt).toContain("[END_DOMAIN_SPECIFIC_GENERATION]");
    expect(prompt).toContain("domain_detected=assicurativo");
    expect(prompt).toContain("generate_domain_operative_sections=true");
    expect(prompt).toContain("avoid_generic_fallback_sections=true");
    expect(prompt).toContain("derive_sections_from_domain=true");
    expect(prompt).toContain("use_tables_for_repeatable_data=true");
    expect(prompt).toContain("diversify_placeholder_types=true");
    expect(prompt).toContain("no_project_charter_contamination=true");
  });

  it("does NOT emit DOMAIN_SPECIFIC_GENERATION block when domain is generico", () => {
    const intent: InferredGenerationIntent = {
      archetype: "generic_template",
      domain: "generico",
      purpose: "structured_document",
      audience: ["stakeholder"],
      formality: "media",
      requiredSectionsFromPrompt: [],
      suggestedSections: [],
      suggestedFields: [],
    };

    const prompt = buildTemplatePromptDescription(
      "Crea un template generico.",
      intent,
      DOCUMENT_BLUEPRINTS.generic_template,
      DOMAIN_PROFILES.generico,
    );

    expect(prompt).not.toContain("[DOMAIN_SPECIFIC_GENERATION]");
    expect(prompt).not.toContain("[END_DOMAIN_SPECIFIC_GENERATION]");
  });

  it("does NOT emit DOMAIN_SPECIFIC_GENERATION block for non-generic archetypes", () => {
    const intent: InferredGenerationIntent = {
      archetype: "scheda",
      domain: "assicurativo",
      purpose: "insurance_sheet",
      audience: ["stakeholder"],
      formality: "media",
      requiredSectionsFromPrompt: [],
      suggestedSections: ["Dati polizza"],
      suggestedFields: ["numero_polizza"],
    };

    const prompt = buildTemplatePromptDescription(
      "Crea una scheda assicurativa.",
      intent,
      DOCUMENT_BLUEPRINTS.scheda,
      DOMAIN_PROFILES.assicurativo,
    );

    expect(prompt).not.toContain("[DOMAIN_SPECIFIC_GENERATION]");
  });

  it("emits domain-specific block for commerciale domain", () => {
    const intent: InferredGenerationIntent = {
      archetype: "generic_template",
      domain: "commerciale",
      purpose: "structured_document",
      audience: ["stakeholder"],
      formality: "media",
      requiredSectionsFromPrompt: [],
      suggestedSections: [],
      suggestedFields: [],
    };

    const prompt = buildTemplatePromptDescription(
      "Vorrei un template per la gestione di una palestra.",
      intent,
      DOCUMENT_BLUEPRINTS.generic_template,
      DOMAIN_PROFILES.commerciale,
    );

    expect(prompt).toContain("[DOMAIN_SPECIFIC_GENERATION]");
    expect(prompt).toContain("domain_detected=commerciale");
  });

  it("includes domain-specific instructions about tables and placeholder diversity", () => {
    const intent: InferredGenerationIntent = {
      archetype: "generic_template",
      domain: "assicurativo",
      purpose: "structured_document",
      audience: ["stakeholder"],
      formality: "media",
      requiredSectionsFromPrompt: [],
      suggestedSections: [],
      suggestedFields: [],
    };

    const prompt = buildTemplatePromptDescription(
      "Vorrei un template per la gestione di un'agenzia assicurativa.",
      intent,
      DOCUMENT_BLUEPRINTS.generic_template,
      DOMAIN_PROFILES.assicurativo,
    );

    expect(prompt).toContain("tabelle Markdown");
    expect(prompt).toContain("Diversifica i tipi di placeholder");
    expect(prompt).toContain("NON contaminare con sezioni di Project Charter");
    expect(prompt).toContain("NON generare sezioni generiche come Contesto");
  });

  it("includes anti-patterns from blueprint in domain-specific block", () => {
    const intent: InferredGenerationIntent = {
      archetype: "generic_template",
      domain: "assicurativo",
      purpose: "structured_document",
      audience: ["stakeholder"],
      formality: "media",
      requiredSectionsFromPrompt: [],
      suggestedSections: [],
      suggestedFields: [],
    };

    const prompt = buildTemplatePromptDescription(
      "Vorrei un template per la gestione di un'agenzia assicurativa.",
      intent,
      DOCUMENT_BLUEPRINTS.generic_template,
      DOMAIN_PROFILES.assicurativo,
    );

    expect(prompt).toContain("[ANTI_PATTERNS_TO_AVOID]");
    expect(prompt).toContain("Non importare sezioni specialistiche");
    expect(prompt).toContain("business case");
    expect(prompt).toContain("autorita del project manager");
    expect(prompt).toContain("approvazioni finali");
  });

  it("includes suggested sections from domain profile", () => {
    const intent: InferredGenerationIntent = {
      archetype: "generic_template",
      domain: "assicurativo",
      purpose: "structured_document",
      audience: ["stakeholder"],
      formality: "media",
      requiredSectionsFromPrompt: [],
      suggestedSections: [],
      suggestedFields: [],
    };

    const prompt = buildTemplatePromptDescription(
      "Vorrei un template per la gestione di un'agenzia assicurativa.",
      intent,
      DOCUMENT_BLUEPRINTS.generic_template,
      DOMAIN_PROFILES.assicurativo,
    );

    expect(prompt).toContain("suggested_sections_from_domain=");
    expect(prompt).toContain("Clienti");
    expect(prompt).toContain("Polizze");
    expect(prompt).toContain("Sinistri");
  });
});
