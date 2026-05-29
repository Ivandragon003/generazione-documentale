import type { TemplateSyntaxSpec } from "../ai/ai-provider.interface";
import type { InferredGenerationIntent } from "../template-intent.classifier";
import type { DocumentBlueprintRule } from "../template-profiles/document-type.profiles";
import type { DomainProfileRule } from "../template-profiles/domain.profiles";

export function buildTemplatePromptDescription(
  userDescription: string,
  intent: InferredGenerationIntent,
  blueprint?: DocumentBlueprintRule,
  domainProfile?: DomainProfileRule,
  syntaxSpec?: TemplateSyntaxSpec | null,
): string {
  const compactList = (items: string[] | undefined, maxItems: number) =>
    items?.length ? items.slice(0, maxItems).join(" | ") : "none";
  const explicitSections =
    intent.requiredSectionsFromPrompt.length > 0
      ? intent.requiredSectionsFromPrompt.join(" | ")
      : "none";
  const commonPromptRules = [
    "output_only_markdown=true",
    "professional_structure=true",
    "ordered_headings=true",
    "descriptive_text_before_fields=true",
    "valid_placeholders_required=true",
    "no_duplicate_sections=true",
    "no_duplicate_consecutive_titles=true",
    "no_malformed_placeholders=true",
    "no_unsupported_placeholder_types=true",
    "no_table_placeholder_type=true",
    "no_subtable_placeholder_type=true",
    "markdown_tables_with_valid_cell_placeholders_only=true",
    "use_tables_when_useful=true",
    "no_external_comments=true",
    "coherence_with_user_request=true",
    "preserve_language_accents=true",
    "avoid_profile_contamination=true",
    "uniform_section_editorial_style=true",
    "avoid_redundant_spiegazione_descrittiva_subsections=true",
    "canonical_extended_placeholders_only=true",
  ];
  const outputConstraints = [
    "single_markdown_document=true",
    "no_json=true",
    "no_explanations_outside_template=true",
    "avoid_truncated_output=true",
  ];
  const context = [
    `document_type=${intent.archetype}`,
    `domain=${intent.domain}`,
    `purpose=${intent.purpose}`,
    `audience=${intent.audience.join(",")}`,
    `formality=${intent.formality}`,
  ];
  const userRequirements = [`required_sections_from_user=${explicitSections}`];
  const documentTypeProfile = [
    `profile_active=${intent.archetype}`,
    `detail_level=${blueprint?.detailLevel ?? "standard"}`,
    `suggested_sections=${intent.suggestedSections.join(" | ")}`,
    `suggested_fields=${intent.suggestedFields.join(",")}`,
    blueprint &&
    !(intent.archetype === "generic_template" && intent.domain !== "generico")
      ? `required_sections_by_type=${blueprint.requiredSections.join(" | ")}`
      : "required_sections_by_type=none",
    blueprint
      ? `recommended_table_sections=${blueprint.recommendedTableSections.join(" | ")}`
      : "recommended_table_sections=none",
    blueprint?.contentDirectives?.length
      ? `content_directives=${compactList(blueprint.contentDirectives, 6)}`
      : "content_directives=none",
    blueprint?.sectionGuidance?.length
      ? `section_guidance=${compactList(blueprint.sectionGuidance, 4)}`
      : "section_guidance=none",
    blueprint?.recommendedPlaceholders?.length
      ? `recommended_placeholders=${compactList(blueprint.recommendedPlaceholders, 8)}`
      : "recommended_placeholders=none",
    blueprint?.profileExamples?.length
      ? `profile_examples=${compactList(blueprint.profileExamples, 3)}`
      : "profile_examples=none",
    blueprint?.antiPatterns?.length
      ? `anti_patterns=${compactList(blueprint.antiPatterns, 4)}`
      : "anti_patterns=none",
    blueprint?.tableSchemas
      ? `table_schemas=${Object.entries(blueprint.tableSchemas)
          .map(([section, headers]) => `${section}=>${headers.join(",")}`)
          .join(" | ")}`
      : "table_schemas=none",
    `reference_standard=${blueprint?.referenceStandard ?? "none"}`,
  ];
  const domainProfileBlock = [
    `profile_active=${intent.domain}`,
    `semantic_rules=${(domainProfile?.semanticRules ?? ["none"]).join(" | ")}`,
    `recommended_terms=${(domainProfile?.recommendedTerms ?? ["none"]).join(" | ")}`,
  ];
  const isDomainSpecificGeneric =
    intent.archetype === "generic_template" && intent.domain !== "generico";
  const domainSpecificBlock = isDomainSpecificGeneric
    ? [
        "[DOMAIN_SPECIFIC_GENERATION]",
        `domain_detected=${intent.domain}`,
        "generate_domain_operative_sections=true",
        "avoid_generic_fallback_sections=true",
        "derive_sections_from_domain=true",
        "use_tables_for_repeatable_data=true",
        "diversify_placeholder_types=true",
        "no_project_charter_contamination=true",
        "ISTRUZIONI: L'utente ha indicato un dominio specifico. Genera sezioni operative concrete e coerenti con il dominio richiesto.",
        "NON generare sezioni generiche come Contesto, Obiettivi, Contenuto principale. Deriva sezioni dal dominio indicato.",
        "Usa tabelle Markdown per dati ripetibili (elenchi clienti, scadenze, pagamenti, iscritti, inventari, ecc.).",
        "Diversifica i tipi di placeholder: usa string, text, date, currency, integer, percentage, boolean, email, phone secondo il contenuto.",
        "NON contaminare con sezioni di Project Charter, verbale o altri tipi documento non richiesti.",
        blueprint?.antiPatterns?.length
          ? `[ANTI_PATTERNS_TO_AVOID] ${blueprint.antiPatterns.join(" || ")}`
          : "",
        ...(domainProfile?.suggestedSections?.length
          ? [
              `suggested_sections_from_domain=${domainProfile.suggestedSections.join(" | ")}`,
            ]
          : []),
        "[END_DOMAIN_SPECIFIC_GENERATION]",
      ].filter(Boolean)
    : [];
  const pack = [
    "[BACKEND_INTENT_NORMALIZATION]",
    ...context,
    "[END_BACKEND_INTENT_NORMALIZATION]",
    "[COMMON_PROMPT_RULES]",
    ...commonPromptRules,
    "[END_COMMON_PROMPT_RULES]",
    "[DOCUMENT_TYPE_PROFILE]",
    ...documentTypeProfile,
    "[END_DOCUMENT_TYPE_PROFILE]",
    "[DOMAIN_PROFILE]",
    ...domainProfileBlock,
    "[END_DOMAIN_PROFILE]",
    ...domainSpecificBlock,
    "[USER_EXPLICIT_REQUIREMENTS]",
    ...userRequirements,
    "[END_USER_EXPLICIT_REQUIREMENTS]",
    "[OUTPUT_CONSTRAINTS]",
    ...outputConstraints,
    "[END_OUTPUT_CONSTRAINTS]",
    ...(syntaxSpec?.compactGrammar
      ? [
          "[OFFICIAL_PLACEHOLDER_SYNTAX]",
          syntaxSpec.compactGrammar,
          "[END_OFFICIAL_PLACEHOLDER_SYNTAX]",
        ]
      : []),
  ].join("\n");

  return `${userDescription.trim()}\n\n${pack}`;
}
