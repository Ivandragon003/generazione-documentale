import { randomUUID } from "node:crypto";
import { rmSync } from "node:fs";
import { access, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { sha256Signature } from "../src/common/utils/signature.utils";
import { TemplateStorageService } from "../src/service/template-storage.service";

describe("TemplateStorageService", () => {
  const basePath = join(process.cwd(), "tmp-test-storage", randomUUID());

  beforeAll(() => {
    process.env.TEMPLATES_STORAGE_PATH = basePath;
  });

  afterAll(() => {
    rmSync(basePath, { recursive: true, force: true });
    delete process.env.TEMPLATES_STORAGE_PATH;
  });

  it("resolves tenant aware path", () => {
    const service = new TemplateStorageService();
    const fullPath = service.resolveTenantPath(
      "11111111-1111-1111-1111-111111111111",
      "gare/capitolati/capitolato-tecnico",
    );
    expect(fullPath).toContain(
      "11111111-1111-1111-1111-111111111111\\gare\\capitolati\\capitolato-tecnico.md",
    );
  });

  it("blocks path traversal", () => {
    const service = new TemplateStorageService();
    expect(() =>
      service.resolveTenantPath(
        "11111111-1111-1111-1111-111111111111",
        "../other-tenant/secret",
      ),
    ).toThrow();
  });

  it("calculates a stable SHA-256 checksum for template content", () => {
    const service = new TemplateStorageService();
    expect(service.calculateContentChecksum("# Template")).toBe(
      sha256Signature("# Template"),
    );
  });

  it("accepts intact cached content when checksum matches", async () => {
    const service = new TemplateStorageService();

    await service.writeTemplate(
      "11111111-1111-1111-1111-111111111111",
      "integrity/intact",
      "# Intact",
    );

    await expect(
      service.readTemplate(
        "11111111-1111-1111-1111-111111111111",
        "integrity/intact",
      ),
    ).resolves.toBe("# Intact");
  });

  it("invalidates corrupted cached content with checksum mismatch as a cache miss", async () => {
    const service = new TemplateStorageService();
    const tenantUuid = "11111111-1111-1111-1111-111111111111";
    const templatePath = "integrity/corrupted";
    const fullPath = service.resolveTenantPath(tenantUuid, templatePath);

    await service.writeTemplate(tenantUuid, templatePath, "# Original");
    await writeFile(fullPath, "# Corrupted", "utf8");

    await expect(
      service.readTemplate(tenantUuid, templatePath),
    ).resolves.toBeNull();
    await expect(access(fullPath)).rejects.toThrow();
    await expect(access(`${fullPath}.sha256`)).rejects.toThrow();
  });

  it("treats cached content without checksum metadata as a cache miss", async () => {
    const service = new TemplateStorageService();
    const tenantUuid = "11111111-1111-1111-1111-111111111111";
    const templatePath = "integrity/missing-checksum";
    const fullPath = service.resolveTenantPath(tenantUuid, templatePath);

    await service.writeTemplate(tenantUuid, templatePath, "# Original");
    await rm(`${fullPath}.sha256`, {
      force: true,
    });

    await expect(
      service.readTemplate(tenantUuid, templatePath),
    ).resolves.toBeNull();
    await expect(access(fullPath)).rejects.toThrow();
  });

  it("returns null when cached content is absent", async () => {
    const service = new TemplateStorageService();

    await expect(
      service.readTemplate(
        "11111111-1111-1111-1111-111111111111",
        "integrity/not-present",
      ),
    ).resolves.toBeNull();
  });

  it("stores checksum as local cache metadata without changing source of truth", async () => {
    const service = new TemplateStorageService();
    const tenantUuid = "11111111-1111-1111-1111-111111111111";
    const templatePath = "integrity/metadata";

    await service.writeTemplate(tenantUuid, templatePath, "# Metadata");

    const checksum = await readFile(
      `${service.resolveTenantPath(tenantUuid, templatePath)}.sha256`,
      "utf8",
    );
    expect(checksum).toBe(sha256Signature("# Metadata"));
    await expect(
      service.readTemplate(tenantUuid, "integrity/missing"),
    ).resolves.toBeNull();
  });
});
