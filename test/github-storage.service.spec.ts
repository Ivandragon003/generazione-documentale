import { GitHubStorageService } from "../src/service/github-storage.service";

type MockResponseShape = {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
  text: () => Promise<string>;
};

function mockResponse(
  status: number,
  body: unknown,
  ok = status >= 200 && status < 300,
): MockResponseShape {
  return {
    ok,
    status,
    json: async () => body,
    text: async () =>
      typeof body === "string" ? body : JSON.stringify(body ?? {}),
  };
}

describe("GitHubStorageService", () => {
  const envBackup = { ...process.env };
  const fetchMock = jest.fn<
    Promise<MockResponseShape>,
    [string, RequestInit?]
  >();

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.GITHUB_TOKEN = "token";
    process.env.GITHUB_OWNER = "owner";
    process.env.GITHUB_REPO = "repo";
    process.env.GITHUB_BRANCH = "main";
    process.env.GITHUB_TEMPLATES_DIR = "templates";
    process.env.DEFAULT_TENANT_UUID = "11111111-1111-1111-1111-111111111111";
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterAll(() => {
    process.env = envBackup;
  });

  it("normalizes template ids and tenant template paths", () => {
    const service = new GitHubStorageService();
    expect(service.normalizeTemplateId(" github:templates/a/b/file.md ")).toBe(
      "a/b/file",
    );
    expect(
      service.normalizeTenantTemplatePath(
        "11111111-1111-1111-1111-111111111111/contracts/base.md",
      ),
    ).toBe("contracts/base");
    expect(service.filePathForTenant("tenant-1", "contracts/base")).toBe(
      "templates/tenant-1/contracts/base.md",
    );
  });

  it("rejects operations when github storage is not configured", async () => {
    process.env.GITHUB_TOKEN = "";
    const service = new GitHubStorageService();

    await expect(service.listTemplates()).rejects.toMatchObject({
      status: 503,
    });
  });

  it("reads template content from github", async () => {
    const service = new GitHubStorageService();
    const encoded = Buffer.from("# Hello", "utf8").toString("base64");
    fetchMock.mockResolvedValueOnce(
      mockResponse(200, {
        sha: "abc123",
        content: encoded,
      }),
    );

    const content = await service.readTemplate("contracts/base");
    expect(content).toBe("# Hello");
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/contents/templates/contracts/base.md?ref=main"),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer token",
        }),
      }),
    );
  });

  it("returns null when template is missing on github", async () => {
    const service = new GitHubStorageService();
    fetchMock.mockResolvedValueOnce(
      mockResponse(404, { message: "not found" }, false),
    );

    await expect(service.readTemplate("missing/template")).resolves.toBeNull();
  });

  it("lists template versions and maps metadata", async () => {
    const service = new GitHubStorageService();
    fetchMock.mockResolvedValueOnce(
      mockResponse(200, [
        {
          sha: "1234567890abcdef",
          commit: {
            message: "feat: update contract",
            author: { name: "Mario", date: "2026-05-21T12:00:00Z" },
          },
        },
      ]),
    );

    const versions = await service.listTemplateVersions(
      "tenant-1",
      "contracts/base",
    );
    expect(versions).toEqual([
      {
        sha: "1234567890abcdef",
        shortSha: "1234567",
        message: "feat: update contract",
        author: "Mario",
        committedAt: "2026-05-21T12:00:00Z",
      },
    ]);
  });

  it("writes tenant template and includes sha when file exists", async () => {
    const service = new GitHubStorageService();
    const existingContent = Buffer.from("old", "utf8").toString("base64");
    fetchMock
      .mockResolvedValueOnce(
        mockResponse(200, { sha: "oldsha", content: existingContent }),
      )
      .mockResolvedValueOnce(mockResponse(200, { ok: true }));

    await service.writeTemplateForTenant(
      "tenant-1",
      "contracts/base",
      "# New content",
      "chore: custom message",
    );

    const secondCall = fetchMock.mock.calls[1];
    expect(secondCall?.[1]).toEqual(
      expect.objectContaining({
        method: "PUT",
      }),
    );
    const body = JSON.parse(String(secondCall?.[1]?.body)) as {
      sha?: string;
      message: string;
      branch: string;
      content: string;
    };
    expect(body.sha).toBe("oldsha");
    expect(body.message).toBe("chore: custom message");
    expect(body.branch).toBe("main");
    expect(Buffer.from(body.content, "base64").toString("utf8")).toBe(
      "# New content",
    );
  });

  it("skips delete when tenant template does not exist", async () => {
    const service = new GitHubStorageService();
    fetchMock.mockResolvedValueOnce(
      mockResponse(404, { message: "not found" }, false),
    );

    await service.deleteTemplateForTenant("tenant-1", "contracts/base");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
