import { Inject, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import type { Repository } from "typeorm";
import { makeError } from "../common/utils/errors";
import { TemplateFieldListEntity } from "../entities/template-field-list.entity";
import { TemplatePlaceholderService } from "./template-placeholder.service";

@Injectable()
export class TemplateFieldListsService {
  constructor(
    @InjectRepository(TemplateFieldListEntity)
    private readonly repository: Repository<TemplateFieldListEntity>,
    @Inject(TemplatePlaceholderService)
    private readonly placeholderService: TemplatePlaceholderService,
  ) {}

  private normalizeValues(values: string[]): string[] {
    return values
      .map((value) => value.trim())
      .filter(Boolean)
      .filter((value, index, items) => items.indexOf(value) === index);
  }

  async upsertTemplateFieldList(
    tenantUuid: string,
    listName: string,
    values: string[],
  ): Promise<TemplateFieldListEntity> {
    const normalizedValues = this.normalizeValues(values);
    if (!tenantUuid.trim()) throw makeError("tenantUuid is required", 400);
    if (!listName.trim()) throw makeError("listName is required", 400);
    if (normalizedValues.length === 0) {
      throw makeError("list values are required", 400);
    }

    const existing = await this.repository.findOneBy({
      tenant_uuid: tenantUuid,
      list_name: listName,
    });
    if (!existing) {
      return this.repository.save(
        this.repository.create({
          tenant_uuid: tenantUuid,
          list_name: listName,
          values: normalizedValues,
        }),
      );
    }

    if (JSON.stringify(existing.values) === JSON.stringify(normalizedValues)) {
      return existing;
    }
    existing.values = normalizedValues;
    return this.repository.save(existing);
  }

  async syncTemplateListsForTenant(
    tenantUuid: string,
    content: string,
  ): Promise<void> {
    const parsedFields = this.placeholderService.extractTemplateFields(content);
    const listFields = parsedFields.filter(
      (field) =>
        field.type === "list" &&
        field.listName &&
        field.listValues &&
        field.listValues.length > 0,
    );
    for (const field of listFields) {
      await this.upsertTemplateFieldList(
        tenantUuid,
        field.listName as string,
        field.listValues as string[],
      );
    }
  }

  async getListValuesForTenant(
    tenantUuid: string,
    listName: string,
  ): Promise<string[]> {
    const entity = await this.repository.findOneBy({
      tenant_uuid: tenantUuid,
      list_name: listName,
    });
    if (!entity) throw makeError("Template list not found", 404);
    return entity.values;
  }

  async listTemplateListsForTenant(tenantUuid: string) {
    return this.repository.find({
      where: { tenant_uuid: tenantUuid },
      order: { list_name: "ASC" },
    });
  }
}
