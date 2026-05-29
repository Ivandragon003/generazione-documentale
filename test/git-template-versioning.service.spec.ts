import { Test, type TestingModule } from "@nestjs/testing";
import { AuditLogsService } from "../src/service/audit-logs.service";
import { GitTemplateVersioningService } from "../src/service/git-template-versioning.service";
import { GitHubStorageService } from "../src/service/github-storage.service";
import { TemplateStorageService } from "../src/service/template-storage.service";
import { TenantProvider } from "../src/service/tenant-provider.service";

describe("GitTemplateVersioningService", () => {
  let service: GitTemplateVersioningService;
  let githubStorage: jest.Mocked<GitHubStorageService>;
  let localStorage: jest.Mocked<TemplateStorageService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GitTemplateVersioningService,
        {
          provide: GitHubStorageService,
          useValue: {
            listTemplatesByTenant: jest.fn().mockResolvedValue([]),
            listTemplateVersions: jest.fn().mockResolvedValue([]),
            getTemplateVersionContent: jest.fn(),
            writeTemplateForTenant: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: TemplateStorageService,
          useValue: {
            writeTemplate: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: TenantProvider,
          useValue: {
            getTenantByUuid: jest.fn().mockResolvedValue({
              uuid: "11111111-1111-1111-1111-111111111111",
              name: "Tenant Demo A",
            }),
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

    service = module.get(GitTemplateVersioningService);
    githubStorage = module.get(
      GitHubStorageService,
    ) as jest.Mocked<GitHubStorageService>;
    localStorage = module.get(
      TemplateStorageService,
    ) as jest.Mocked<TemplateStorageService>;
  });

  it("lists template versions", async () => {
    githubStorage.listTemplateVersions.mockResolvedValue([
      {
        sha: "abcdef123456",
        shortSha: "abcdef1",
        message: "update",
        author: "Paolo",
        committedAt: "2026-04-23T10:42:00.000Z",
      },
    ]);
    const versions = await service.listTemplateVersions(
      "11111111-1111-1111-1111-111111111111",
      "gare/capitolati/capitolato-tecnico",
    );
    expect(versions).toHaveLength(1);
  });

  it("gets template content by commit", async () => {
    githubStorage.getTemplateVersionContent.mockResolvedValue("# storico");
    await expect(
      service.getTemplateVersionContent(
        "11111111-1111-1111-1111-111111111111",
        "gare/capitolati/capitolato-tecnico",
        "abcdef",
      ),
    ).resolves.toBe("# storico");
  });

  it("updates template with local and github write", async () => {
    await service.updateTemplate(
      "11111111-1111-1111-1111-111111111111",
      "gare/capitolati/capitolato-tecnico",
      "# new",
      "update",
    );
    expect(localStorage.writeTemplate).toHaveBeenCalled();
    expect(githubStorage.writeTemplateForTenant).toHaveBeenCalled();
  });

  it("restores template with a new commit write", async () => {
    githubStorage.getTemplateVersionContent.mockResolvedValue("# v1");
    await service.restoreTemplateVersion(
      "11111111-1111-1111-1111-111111111111",
      "gare/capitolati/capitolato-tecnico",
      "abcdef123456",
    );
    expect(githubStorage.writeTemplateForTenant).toHaveBeenCalledWith(
      "11111111-1111-1111-1111-111111111111",
      "gare/capitolati/capitolato-tecnico",
      "# v1",
      expect.stringContaining("restore template"),
    );
  });

  it("keeps tenant isolation when syncing", async () => {
    githubStorage.listTemplatesByTenant.mockResolvedValue([
      {
        id: "github:11111111-1111-1111-1111-111111111111/gare/a",
        name: "a",
        content_path: "gare/a",
        githubPath: "11111111-1111-1111-1111-111111111111/gare/a.md",
        category: "gare",
        section: null,
        fields: [],
        created_by: "github",
        created_at: new Date(),
        updated_at: new Date(),
        content: "# a",
      },
    ]);
    await service.syncTenantTemplates("11111111-1111-1111-1111-111111111111");
    expect(localStorage.writeTemplate).toHaveBeenCalledWith(
      "11111111-1111-1111-1111-111111111111",
      "gare/a",
      "# a",
    );
  });
});
