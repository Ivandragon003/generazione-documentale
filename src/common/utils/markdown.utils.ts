import {
  type MarkdownValidationResult,
  type ParsedTemplatePlaceholder,
  type PartialFieldDefinition,
  TemplatePlaceholderService,
} from "../../service/template-placeholder.service";

const templatePlaceholderService = new TemplatePlaceholderService();

export type {
  MarkdownValidationResult,
  ParsedTemplatePlaceholder,
  PartialFieldDefinition,
} from "../../service/template-placeholder.service";
export {
  allowedFieldTypes,
  allowedTemplateFieldTypes,
} from "../../service/template-placeholder.service";

export function parseTemplatePlaceholders(content: string): {
  fields: ParsedTemplatePlaceholder[];
  errors: string[];
  legacyUntypedNames: string[];
} {
  return templatePlaceholderService.parse(content);
}

export const extractFieldNames = (content: string): string[] =>
  templatePlaceholderService.extractFieldNames(content);

export const normalizeFieldDefinitions = (
  content: string,
  inputFields: PartialFieldDefinition[] = [],
) => templatePlaceholderService.normalizeFieldDefinitions(content, inputFields);

export const validateMarkdownContent = (
  content: string,
  maxBytes: number,
): MarkdownValidationResult =>
  templatePlaceholderService.validateMarkdownContent(content, maxBytes);

export const parseTypedPlaceholder = (token: string) =>
  templatePlaceholderService.parseTypedPlaceholder(token);

export const extractTemplateFields = (content: string) =>
  templatePlaceholderService.extractTemplateFields(content);

export const validateFieldValue = (
  field: Parameters<typeof templatePlaceholderService.validateFieldValue>[0],
  value: Parameters<typeof templatePlaceholderService.validateFieldValue>[1],
) => templatePlaceholderService.validateFieldValue(field, value);
