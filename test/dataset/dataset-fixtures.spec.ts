import type { FieldValueMap } from "../../src/service/template-placeholder.service";
import { TemplatePlaceholderService } from "../../src/service/template-placeholder.service";
import { loadDatasetCases } from "../utils/dataset-loader";

function stringify(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

describe("Dataset fixtures", () => {
  const service = new TemplatePlaceholderService();
  const cases = loadDatasetCases({ requireConfigured: true });

  it("loads dataset cases", () => {
    expect(cases.length).toBeGreaterThan(0);
  });

  for (const c of cases) {
    it(`validates dataset case ${c.id}`, () => {
      const parsed = service.parse(c.template);
      const expectedFields = (c.expectedSchema.fields ?? []) as Array<{
        name: string;
        type: string;
        required?: boolean;
      }>;

      const actualFields = parsed.fields.map((field) => ({
        name: field.name,
        type: field.type,
        required: field.required ?? true,
      }));

      if (expectedFields.length > 0) {
        expect(stringify(actualFields)).toBe(stringify(expectedFields));
      }

      const validInput = c.inputValid as FieldValueMap;
      const invalidInput = c.inputInvalid as FieldValueMap;
      const validCheck = service.validateFieldValues(c.template, validInput);
      const deterministicErrors = (
        (c.expectedErrors.deterministic ?? {}) as Record<string, unknown>
      ).errors as Array<Record<string, unknown>>;

      if ((deterministicErrors ?? []).length > 0) {
        expect(validCheck.valid).toBe(false);
      } else {
        expect(validCheck.valid).toBe(true);
      }

      const invalidCheck = service.validateFieldValues(
        c.template,
        invalidInput,
      );
      const expectedInvalidMessages = (c.expectedErrors
        .fieldValidationInvalidInput ?? []) as string[];
      for (const msg of expectedInvalidMessages) {
        expect(invalidCheck.errors.some((item) => item.includes(msg))).toBe(
          true,
        );
      }

      const rendered = service.render(c.template, validInput, true);
      if (c.expectedRender.trim().length > 0) {
        expect(rendered.result.trim()).toBe(c.expectedRender.trim());
      }
    });
  }
});
