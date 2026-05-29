import { MockAiProvider } from "../src/service/ai/mock-ai.provider";
import { OllamaAiProvider } from "../src/service/ai/ollama-ai.provider";
import { AiTemplateAuditorService } from "../src/service/ai-template-auditor.service";
import { TemplateAuditService } from "../src/service/template-audit.service";
import { TemplateDraftGenerationService } from "../src/service/template-draft-generation.service";
import {
  allowedTemplateFieldTypes,
  TemplatePlaceholderService,
} from "../src/service/template-placeholder.service";

describe("TemplateDraftGenerationService domain-specific quality validation", () => {
  const buildService = () => {
    const placeholderService = new TemplatePlaceholderService();
    const auditService = new TemplateAuditService(
      placeholderService,
      new AiTemplateAuditorService(
        new MockAiProvider(),
        new OllamaAiProvider(),
      ),
    );
    return new TemplateDraftGenerationService(
      placeholderService,
      auditService,
      new MockAiProvider(),
      new OllamaAiProvider(),
    );
  };

  describe("domain-specific template generation (agenzia assicurativa)", () => {
    it("should NOT contain Project Manager sections for domain-specific templates", async () => {
      process.env.AI_PROVIDER = "mock";
      const service = buildService();

      const result = await service.generateDraft({
        description:
          "Vorrei un template per la gestione di un'agenzia assicurativa.",
        language: "it",
        autoRepair: true,
      });

      // Anti-patterns to verify are NOT present
      const forbiddenSections = [
        "Project Manager",
        "Autorita del Project Manager",
        "Autorità del Project Manager",
        "Business case",
        "Approvazioni finali",
        "Milestone principali",
        "Stakeholder principali",
      ];

      forbiddenSections.forEach((section) => {
        expect(result.content).not.toContain(`## ${section}`);
        expect(result.content).not.toContain(`### ${section}`);
      });
    });

    it("should NOT contain unsupported placeholder types in field names", async () => {
      process.env.AI_PROVIDER = "mock";
      const service = buildService();

      const result = await service.generateDraft({
        description:
          "Vorrei un template per la gestione di un'agenzia assicurativa.",
        language: "it",
        autoRepair: true,
      });

      // Check for unsupported contamination in field names
      const forbiddenPatterns = [
        /project_manager/i,
        /poderi_/i, // typo for "poteri"
      ];

      forbiddenPatterns.forEach((pattern) => {
        expect(result.content).not.toMatch(pattern);
      });
    });

    it("should NOT contain `:length:` syntax in list placeholders", async () => {
      process.env.AI_PROVIDER = "mock";
      const service = buildService();

      const result = await service.generateDraft({
        description:
          "Vorrei un template per la gestione di un'agenzia assicurativa.",
        language: "it",
        autoRepair: true,
      });

      // List placeholders should use canonical form, not :length: syntax
      expect(result.content).not.toMatch(/\{\{list:[^:]+:length:/i);
    });

    it("should contain domain-operative sections OR NOT generic fallback", async () => {
      process.env.AI_PROVIDER = "mock";
      const service = buildService();

      const result = await service.generateDraft({
        description:
          "Vorrei un template per la gestione di un'agenzia assicurativa.",
        language: "it",
        autoRepair: true,
      });

      // Verify generic fallback sections are NOT present
      // (The prompt instructs NOT to generate these when domain is specific)
      const forbiddenGenericSections = [
        "Contesto",
        "Obiettivi",
        "Contenuto principale",
        "Introduzione generale",
      ];

      forbiddenGenericSections.forEach((section) => {
        if (result.content.includes(`## ${section}`)) {
          // If present, must be followed by domain-specific content
          const sectionContent = result.content.split(`## ${section}`)[1];
          const nextSection = sectionContent.split("##")[0];
          expect(nextSection.length).toBeGreaterThan(50); // Must have substantial content
        }
      });
    });

    it("should have placeholders with diverse types, not only text", async () => {
      process.env.AI_PROVIDER = "mock";
      const service = buildService();

      const result = await service.generateDraft({
        description:
          "Vorrei un template per la gestione di un'agenzia assicurativa.",
        language: "it",
        autoRepair: true,
      });

      // Count different placeholder types
      const types = new Set<string>();
      const placeholderMatches = result.content.match(/\{\{([a-z]+):[^:]+:/g);

      if (placeholderMatches) {
        placeholderMatches.forEach((match: string) => {
          const type = match.match(/\{\{([a-z]+):/)?.[1];
          if (type) types.add(type);
        });
      }

      // Should have at least 2 different types (not just 'text')
      expect(types.size).toBeGreaterThanOrEqual(2);

      // Should NOT be dominated by only 'text' type
      const textCount = (result.content.match(/\{\{text:/g) || []).length || 0;
      const totalCount = placeholderMatches?.length || 0;
      if (totalCount > 0) {
        const textPercentage = (textCount / totalCount) * 100;
        expect(textPercentage).toBeLessThan(90); // text should be < 90%
      }
    });

    it("should NOT contain malformed placeholders or duplicates", async () => {
      process.env.AI_PROVIDER = "mock";
      const service = buildService();

      const result = await service.generateDraft({
        description:
          "Vorrei un template per la gestione di un'agenzia assicurativa.",
        language: "it",
        autoRepair: true,
      });

      // Extract all placeholders
      const placeholders = (result.content.match(/\{\{[^}]+\}\}/g) || []).map(
        (p: string) => p.toLowerCase(),
      );

      // Check for duplicates
      const uniquePlaceholders = new Set(placeholders);
      expect(uniquePlaceholders.size).toBe(placeholders.length);

      // Check for malformed placeholders
      placeholders.forEach((placeholder: string) => {
        // Should match canonical extended form or strict form
        expect(placeholder).toMatch(
          /^\{\{[a-z]+:[a-z_][a-z0-9_]*:(\d+):(true|false)(?::[^:}]*(?::[^}]*)?)?\}\}$/,
        );
      });
    });
  });

  describe("domain-specific template generation (palestra)", () => {
    it("should NOT contain insurance-specific content OR Project Charter contamination for commerciale domain", async () => {
      process.env.AI_PROVIDER = "mock";
      const service = buildService();

      const result = await service.generateDraft({
        description:
          "Vorrei un template per la gestione di una palestra, con iscritti, abbonamenti, scadenze, pagamenti e istruttori.",
        language: "it",
        autoRepair: true,
      });

      // Should NOT contain insurance-specific sections
      const forbiddenInsuranceSections = [
        "Polizze",
        "Sinistri",
        "Massimali",
        "Coperture",
      ];

      forbiddenInsuranceSections.forEach((section) => {
        expect(result.content).not.toContain(`## ${section}`);
      });

      // Should NOT contain Project Charter contamination
      const projectCharterSections = [
        "Autorita del Project Manager",
        "Autorità del Project Manager",
        "Business case",
        "Approvazioni finali",
      ];

      projectCharterSections.forEach((section) => {
        expect(result.content).not.toContain(`## ${section}`);
      });
    });
  });

  describe("field name grammatical correctness", () => {
    it("should NOT generate field names with common typos (e.g., poderi instead of poteri)", async () => {
      process.env.AI_PROVIDER = "mock";
      const service = buildService();

      const result = await service.generateDraft({
        description:
          "Vorrei un template per la gestione di un'agenzia assicurativa con livelli autorizzativi.",
        language: "it",
        autoRepair: true,
      });

      // Common typos to check
      const typos = [
        /{{[^}]*poderi[^}]*}}/g, // poderi instead of poteri
        /{{[^}]*concensus[^}]*}}/g, // typo
        /{{[^}]*aproval[^}]*}}/g, // typo
      ];

      typos.forEach((typo) => {
        expect(result.content).not.toMatch(typo);
      });
    });
  });

  describe("placeholder type validation", () => {
    it("should only use officially supported placeholder types", async () => {
      process.env.AI_PROVIDER = "mock";
      const service = buildService();

      const result = await service.generateDraft({
        description:
          "Vorrei un template per la gestione di un'agenzia assicurativa.",
        language: "it",
        autoRepair: true,
      });

      const allowedTypes = new Set(allowedTemplateFieldTypes);

      // Extract all placeholder types
      const typeMatches = result.content.match(/\{\{([a-z]+):[^:]+:/g) || [];

      typeMatches.forEach((match: string) => {
        const type = match.match(/\{\{([a-z]+):/)?.[1];
        if (type) {
          expect(allowedTypes.has(type as never)).toBe(true);
        }
      });
    });
  });
});
