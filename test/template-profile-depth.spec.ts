import { buildTemplatePromptDescription } from "../src/service/prompt/template-prompt.builder";
import type { InferredGenerationIntent } from "../src/service/template-intent.classifier";
import {
  DOCUMENT_BLUEPRINTS,
  type SupportedDocumentType,
} from "../src/service/template-profiles/document-type.profiles";
import { DOMAIN_PROFILES } from "../src/service/template-profiles/domain.profiles";

const documentTypes: SupportedDocumentType[] = [
  "project_charter",
  "capitolato",
  "verbale",
  "project_plan",
  "scheda",
  "checklist",
  "policy",
  "procedure",
  "report",
  "requirements_document",
  "generic_template",
];

const tokenRegex = /\{\{[^{}\n]*\}\}/g;
const canonicalTokenRegex =
  /^\{\{(?:string|text|date|currency|integer|boolean|percentage|number|email|phone):[a-z_][a-z0-9_]*:\d+:(?:true|false)\}\}$/;

function intentFor(type: SupportedDocumentType): InferredGenerationIntent {
  return {
    archetype: type,
    domain: type === "scheda" ? "assicurativo" : "generico",
    purpose: type,
    audience: ["stakeholder"],
    formality: "media",
    requiredSectionsFromPrompt: [],
    suggestedSections: [],
    suggestedFields: [],
  };
}

describe("document profile depth", () => {
  it("defines proportional qualitative guidance for every document type", () => {
    for (const type of documentTypes) {
      const profile = DOCUMENT_BLUEPRINTS[type];

      expect(profile).toBeDefined();
      expect(profile?.detailLevel).toMatch(
        /^(compact|standard|extended|flexible)$/,
      );
      expect(profile?.sectionGuidance?.length).toBeGreaterThan(0);
      expect(profile?.recommendedPlaceholders?.length).toBeGreaterThan(0);
      expect(profile?.profileExamples?.length).toBeGreaterThan(0);
      expect(profile?.antiPatterns?.length).toBeGreaterThan(0);
    }

    expect(DOCUMENT_BLUEPRINTS.checklist?.detailLevel).toBe("compact");
    expect(DOCUMENT_BLUEPRINTS.scheda?.detailLevel).toBe("compact");
    expect(DOCUMENT_BLUEPRINTS.project_charter?.detailLevel).toBe("extended");
    expect(DOCUMENT_BLUEPRINTS.capitolato?.detailLevel).toBe("extended");
    expect(DOCUMENT_BLUEPRINTS.generic_template?.detailLevel).toBe("flexible");
  });

  it("keeps profile placeholders canonical and free from table/subtable types", () => {
    const serialized = JSON.stringify(DOCUMENT_BLUEPRINTS);
    expect(serialized).not.toMatch(/\{\{(?:table|subtable):/i);

    const tokens = serialized.match(tokenRegex) ?? [];
    expect(tokens.length).toBeGreaterThan(0);
    for (const token of tokens) {
      expect(token).toMatch(canonicalTokenRegex);
    }
  });

  it("keeps generic profile flexible without inheriting specific document sections", () => {
    const generic = DOCUMENT_BLUEPRINTS.generic_template;
    const joined = [
      ...(generic?.requiredSections ?? []),
      ...(generic?.sectionGuidance ?? []),
      ...(generic?.contentDirectives ?? []),
      ...(generic?.profileExamples ?? []),
    ].join(" ");

    expect(joined).not.toMatch(
      /Project Charter|PMBOK|polizza|massimali|ordine del giorno/i,
    );
    expect(generic?.tableSchemas).toBeUndefined();
  });

  it("prompt includes active profile depth only and remains markdown-only", () => {
    const prompt = buildTemplatePromptDescription(
      "Crea una scheda assicurativa sintetica",
      intentFor("scheda"),
      DOCUMENT_BLUEPRINTS.scheda,
      DOMAIN_PROFILES.assicurativo,
    );

    expect(prompt).toContain("detail_level=compact");
    expect(prompt).toContain("section_guidance=");
    expect(prompt).toContain("recommended_placeholders=");
    expect(prompt).toContain("profile_examples=");
    expect(prompt).toContain("profile_active=scheda");
    expect(prompt).not.toContain("profile_active=project_charter");
    expect(prompt).not.toContain("reference_standard=PMBOK_PMI");
    expect(prompt).not.toMatch(/\{\{(?:table|subtable):/i);
    expect(prompt).toContain("output_only_markdown=true");
    expect(prompt).toContain("no_explanations_outside_template=true");
  });
});
