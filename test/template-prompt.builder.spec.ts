import { buildTemplatePromptDescription } from "../src/service/prompt/template-prompt.builder";
import type { InferredGenerationIntent } from "../src/service/template-intent.classifier";
import { DOCUMENT_BLUEPRINTS } from "../src/service/template-profiles/document-type.profiles";
import { DOMAIN_PROFILES } from "../src/service/template-profiles/domain.profiles";

describe("buildTemplatePromptDescription", () => {
  it("includes only active document/domain profile blocks", () => {
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
      "Crea una scheda assicurativa",
      intent,
      DOCUMENT_BLUEPRINTS.scheda,
      DOMAIN_PROFILES.assicurativo,
    );

    expect(prompt).toContain("profile_active=scheda");
    expect(prompt).toContain("profile_active=assicurativo");
    expect(prompt).not.toContain("profile_active=project_charter");
    expect(prompt).not.toContain("profile_active=economico");
  });

  it("forbids table and subtable placeholder types in global prompt rules", () => {
    const intent: InferredGenerationIntent = {
      archetype: "project_charter",
      domain: "project_management",
      purpose: "project_charter",
      audience: ["stakeholder"],
      formality: "media",
      requiredSectionsFromPrompt: [],
      suggestedSections: ["Obiettivi"],
      suggestedFields: ["obiettivi"],
    };

    const prompt = buildTemplatePromptDescription(
      "Crea un project charter",
      intent,
      DOCUMENT_BLUEPRINTS.project_charter,
      DOMAIN_PROFILES.project_management,
    );

    expect(prompt).toContain("no_table_placeholder_type=true");
    expect(prompt).toContain("no_subtable_placeholder_type=true");
    expect(prompt).toContain(
      "markdown_tables_with_valid_cell_placeholders_only=true",
    );
  });

  it("can include official placeholder grammar in the prompt builder output", () => {
    const intent: InferredGenerationIntent = {
      archetype: "scheda",
      domain: "assicurativo",
      purpose: "insurance_sheet",
      audience: ["operatore"],
      formality: "media",
      requiredSectionsFromPrompt: [],
      suggestedSections: ["Dati polizza"],
      suggestedFields: ["numero_polizza"],
    };

    const prompt = buildTemplatePromptDescription(
      "Crea una scheda assicurativa",
      intent,
      DOCUMENT_BLUEPRINTS.scheda,
      DOMAIN_PROFILES.assicurativo,
      {
        version: "test",
        parserVersion: "test",
        supportedTypes: ["string", "list"],
        compactGrammar:
          "TEMPLATE PLACEHOLDER GRAMMAR\n- {{list:stato_cliente_1:100:true:cliente,Sospeso,In attesa}}",
      },
    );

    expect(prompt).toContain("[OFFICIAL_PLACEHOLDER_SYNTAX]");
    expect(prompt).toContain(
      "{{list:stato_cliente_1:100:true:cliente,Sospeso,In attesa}}",
    );
  });
});
