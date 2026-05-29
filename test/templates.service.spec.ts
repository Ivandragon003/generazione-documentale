import { Test, type TestingModule } from "@nestjs/testing";
import type { FieldDefinition } from "../src/common/types/field-definition.type";
import { AuditLogsService } from "../src/service/audit-logs.service";
import { GitTemplateVersioningService } from "../src/service/git-template-versioning.service";
import type { GitHubTemplateFile } from "../src/service/github-storage.service";
import { GitHubStorageService } from "../src/service/github-storage.service";
import { TemplateFieldListsService } from "../src/service/template-field-lists.service";
import { TemplatesService } from "../src/service/templates.service";
import { TenantProvider } from "../src/service/tenant-provider.service";

const VALID_ID = "550e8400-e29b-41d4-a716-446655440000";
const TENANT = "11111111-1111-1111-1111-111111111111";

const normalizeGitHubId = (raw: string): string => {
  let normalized = raw.replace(/^github:/, "").replace(/^templates\//, "");
  if (normalized.endsWith(".md")) normalized = normalized.slice(0, -3);
  return normalized;
};

const makeGitHubTemplate = (
  raw: string,
  content = "# {{title}}",
  fields: FieldDefinition[] = [],
): GitHubTemplateFile => {
  const id = normalizeGitHubId(raw);
  const parts = id.split("/");
  const now = new Date("2024-01-01");
  return {
    id: `github:${id}`,
    name: parts.at(-1) ?? id,
    content_path: id,
    githubPath: `templates/${id}.md`,
    category: parts.length >= 3 ? parts[0] : null,
    section: parts.length >= 3 ? parts[1] : null,
    fields,
    created_by: "github",
    created_at: now,
    updated_at: now,
    content,
  };
};

describe("TemplatesService", () => {
  let service: TemplatesService;
  let githubStorage: jest.Mocked<GitHubStorageService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TemplatesService,
        {
          provide: GitHubStorageService,
          useValue: {
            readTemplate: jest.fn(),
            getTemplate: jest.fn(),
            writeTemplate: jest.fn(),
            deleteTemplate: jest.fn(),
            listTemplates: jest.fn().mockResolvedValue([]),
            normalizeTemplateId: jest.fn(normalizeGitHubId),
            filePath: jest.fn((id: string) => `templates/${id}.md`),
            templateMetaFromPath: jest.fn((path: string) => {
              const relativePath = path.startsWith("templates/")
                ? path.slice(10)
                : path;
              const parts = relativePath.split("/");
              const filename = parts.at(-1) ?? relativePath;
              const name = filename.replace(/\.md$/i, "");
              const templateId = normalizeGitHubId(relativePath);
              return {
                relativePath,
                templateId,
                name,
                category: parts.length >= 2 ? parts[0] : null,
                section: parts.length >= 3 ? parts[1] : null,
              };
            }),
            listTemplatesByTenant: jest.fn().mockResolvedValue([]),
            getTemplateForTenant: jest.fn(),
            filePathForTenant: jest.fn(
              (tenant: string, id: string) => `${tenant}/${id}.md`,
            ),
            templateMetaFromTenantPath: jest.fn(
              (tenant: string, path: string) => {
                const relativePath = path.startsWith(`${tenant}/`)
                  ? path.slice(tenant.length + 1)
                  : path;
                const parts = relativePath.split("/");
                const filename = parts.at(-1) ?? relativePath;
                const name = filename.replace(/\.md$/i, "");
                return {
                  relativePath,
                  templateId: normalizeGitHubId(relativePath),
                  name,
                  category: parts.length >= 2 ? parts[0] : null,
                  section: parts.length >= 3 ? parts[1] : null,
                  tenantUuid: tenant,
                };
              },
            ),
            normalizeTenantTemplatePath: jest.fn(normalizeGitHubId),
            writeTemplateForTenant: jest.fn(),
            deleteTemplateForTenant: jest.fn(),
          },
        },
        {
          provide: GitTemplateVersioningService,
          useValue: {
            syncTenantTemplates: jest.fn().mockResolvedValue(undefined),
            updateTemplate: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: TenantProvider,
          useValue: {
            getTenantByUuid: jest.fn().mockResolvedValue({
              uuid: TENANT,
              name: "Tenant Demo A",
            }),
          },
        },
        {
          provide: TemplateFieldListsService,
          useValue: {
            syncTemplateListsForTenant: jest.fn().mockResolvedValue(undefined),
            getListValuesForTenant: jest
              .fn()
              .mockRejectedValue(new Error("not found")),
          },
        },
        {
          provide: AuditLogsService,
          useValue: {
            recordSafe: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<TemplatesService>(TemplatesService);
    githubStorage = module.get(
      GitHubStorageService,
    ) as jest.Mocked<GitHubStorageService>;

    githubStorage.getTemplateForTenant.mockImplementation(
      async (tenant: string, raw: string) => {
        const content = await githubStorage.readTemplate(`${tenant}/${raw}`);
        return content === null
          ? null
          : makeGitHubTemplate(`${tenant}/${raw}`, content);
      },
    );
  });

  afterEach(() => jest.resetAllMocks());

  it("creates a template on GitHub", async () => {
    const result = await service.create({
      tenantUuid: TENANT,
      name: "Template test",
      content: "# {{title}}",
    });

    expect(result.id.startsWith("github:")).toBe(true);
  });

  it("fails create with empty name", async () => {
    await expect(
      service.create({ tenantUuid: TENANT, name: " ", content: "# a" }),
    ).rejects.toMatchObject({
      status: 400,
    });
  });

  it("finds one template from GitHub", async () => {
    githubStorage.readTemplate.mockResolvedValue("# {{title}}");
    const result = await service.findOne(TENANT, `github:${VALID_ID}`);
    expect(result?.id).toBe(`github:${TENANT}/${VALID_ID}`);
  });

  it("returns null when template is missing on GitHub", async () => {
    githubStorage.readTemplate.mockResolvedValue(null);
    await expect(
      service.findOne(TENANT, `github:${VALID_ID}`),
    ).resolves.toBeNull();
  });

  it("updates an existing GitHub template", async () => {
    githubStorage.readTemplate.mockResolvedValue("# {{title}}");
    const result = await service.update(TENANT, `github:${VALID_ID}`, {
      name: "Updated",
      content: "# {{title}}\nchanged",
    });

    expect(result.name).toBe("Updated");
    // write is delegated to versioning service
  });

  it("deletes a GitHub template", async () => {
    await expect(
      service.delete(TENANT, "github:portfolio/sample"),
    ).resolves.toEqual({
      deleted: true,
    });
    expect(githubStorage.deleteTemplateForTenant).toHaveBeenCalledWith(
      TENANT,
      "portfolio/sample",
    );
  });

  it("resolves template id for jobs as github id", async () => {
    githubStorage.getTemplateForTenant.mockResolvedValue(
      makeGitHubTemplate(`${TENANT}/${VALID_ID}`, "# {{title}}"),
    );
    await expect(
      service.resolveTemplateIdForPdfJob(`github:${TENANT}/${VALID_ID}`),
    ).resolves.toBe(`github:${TENANT}/${VALID_ID}`);
  });

  it("lists templates from GitHub only", async () => {
    githubStorage.listTemplatesByTenant.mockResolvedValue([
      makeGitHubTemplate(`${TENANT}/portfolio/section-a/one`, "# 1"),
      makeGitHubTemplate(`${TENANT}/portfolio/section-a/two`, "# 2"),
    ]);

    const result = await service.findAll({
      tenantUuid: TENANT,
      limit: 20,
      offset: 0,
    });
    expect(result.total).toBe(2);
    expect(result.data).toHaveLength(2);
  });
});
