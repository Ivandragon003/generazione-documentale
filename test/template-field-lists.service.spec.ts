import { TemplateFieldListsService } from "../src/service/template-field-lists.service";
import { TemplatePlaceholderService } from "../src/service/template-placeholder.service";

function createRepositoryMock() {
  const store: Array<{
    id: string;
    tenant_uuid: string;
    list_name: string;
    values: string[];
  }> = [];
  return {
    store,
    findOneBy: jest.fn(
      async (where: { tenant_uuid: string; list_name: string }) =>
        store.find(
          (item) =>
            item.tenant_uuid === where.tenant_uuid &&
            item.list_name === where.list_name,
        ) ?? null,
    ),
    create: jest.fn((payload) => ({ id: "list-id", ...payload })),
    save: jest.fn(async (entity) => {
      const index = store.findIndex(
        (item) =>
          item.tenant_uuid === entity.tenant_uuid &&
          item.list_name === entity.list_name,
      );
      if (index >= 0) store[index] = { ...store[index], ...entity };
      else store.push(entity);
      return entity;
    }),
    find: jest.fn(async ({ where }: { where: { tenant_uuid: string } }) =>
      store.filter((item) => item.tenant_uuid === where.tenant_uuid),
    ),
  };
}

describe("TemplateFieldListsService", () => {
  it("upserts list values without duplicates and preserves order", async () => {
    const repository = createRepositoryMock();
    const service = new TemplateFieldListsService(
      repository as never,
      new TemplatePlaceholderService(),
    );

    await service.upsertTemplateFieldList("tenant-a", "contract_types", [
      " Servizi ",
      "Forniture",
      "Servizi",
      "",
      "Lavori",
    ]);

    const values = await service.getListValuesForTenant(
      "tenant-a",
      "contract_types",
    );
    expect(values).toEqual(["Servizi", "Forniture", "Lavori"]);
  });

  it("isolates lists by tenant", async () => {
    const repository = createRepositoryMock();
    const service = new TemplateFieldListsService(
      repository as never,
      new TemplatePlaceholderService(),
    );
    await service.upsertTemplateFieldList("tenant-a", "contract_types", [
      "Servizi",
    ]);
    await service.upsertTemplateFieldList("tenant-b", "contract_types", [
      "Forniture",
    ]);

    await expect(
      service.getListValuesForTenant("tenant-c", "contract_types"),
    ).rejects.toBeTruthy();
    expect(
      await service.getListValuesForTenant("tenant-a", "contract_types"),
    ).toEqual(["Servizi"]);
    expect(
      await service.getListValuesForTenant("tenant-b", "contract_types"),
    ).toEqual(["Forniture"]);
  });

  it("syncs list placeholders found in template content", async () => {
    const repository = createRepositoryMock();
    const service = new TemplateFieldListsService(
      repository as never,
      new TemplatePlaceholderService(),
    );
    await service.syncTemplateListsForTenant(
      "tenant-a",
      "{{list:tipologia_contratto:80:true:tipologie_contratto:Servizi,Forniture,Lavori}}",
    );

    expect(
      await service.getListValuesForTenant("tenant-a", "tipologie_contratto"),
    ).toEqual(["Servizi", "Forniture", "Lavori"]);
  });

  it("syncs official list placeholders by deriving a technical DB name from the label", async () => {
    const repository = createRepositoryMock();
    const service = new TemplateFieldListsService(
      repository as never,
      new TemplatePlaceholderService(),
    );
    await service.syncTemplateListsForTenant(
      "tenant-a",
      "{{list:priorita:100:true:Priorità:bassa,media,alta}}",
    );

    expect(
      await service.getListValuesForTenant("tenant-a", "priorita"),
    ).toEqual(["bassa", "media", "alta"]);
  });
});
