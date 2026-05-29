import { Inject, Injectable, Optional } from "@nestjs/common";
import {
  type FieldValueMap,
  TemplatePlaceholderService,
} from "./template-placeholder.service";

export type {
  FieldPrimitive,
  FieldRow,
  FieldValue,
  FieldValueMap,
} from "./template-placeholder.service";

@Injectable()
export class DocumentRenderingService {
  constructor(
    @Optional()
    @Inject(TemplatePlaceholderService)
    private readonly templatePlaceholderService: TemplatePlaceholderService = new TemplatePlaceholderService(),
  ) {}

  renderTemplate(
    content: string,
    fieldValues: FieldValueMap,
    strict: boolean,
  ): { result: string; unresolved: string[] } {
    return this.templatePlaceholderService.render(content, fieldValues, strict);
  }
}
