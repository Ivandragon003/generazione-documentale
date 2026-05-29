const APP_CONFIG_KEYS = [
  "MAX_TEMPLATE_CONTENT_BYTES",
  "PDF_QUEUE_RECOVERY_RETRY_MS",
  "PDF_JOBS_RETENTION_DAYS",
  "PDF_FAILED_JOBS_RETENTION_DAYS",
  "PDF_RETENTION_RUN_EVERY_MS",
  "AUDIT_LOG_RETENTION_DAYS",
];

const buildAppConfigWithEnv = async (
  env: Record<string, string | undefined>,
) => {
  for (const key of APP_CONFIG_KEYS) {
    delete process.env[key];
  }
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }

  const warnMock = jest.fn();
  jest.resetModules();
  jest.doMock("@nestjs/common", () => ({
    Logger: class {
      warn(message: string): void {
        warnMock(message);
      }
    },
  }));
  const mod = await import("../src/config/app.config");
  jest.dontMock("@nestjs/common");
  return { appConfig: mod.appConfig, warnMock };
};

describe("app.config", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("non emette warning quando usa default per env non impostate", async () => {
    const { appConfig, warnMock } = await buildAppConfigWithEnv({});

    expect(appConfig.maxTemplateContentBytes).toBe(200000);
    expect(appConfig.auditLogRetentionDays).toBe(180);
    expect(warnMock).not.toHaveBeenCalled();
  });

  it("emette warning per valori esplicitamente invalidi", async () => {
    const { appConfig, warnMock } = await buildAppConfigWithEnv({
      MAX_TEMPLATE_CONTENT_BYTES: "999",
    });

    expect(appConfig.maxTemplateContentBytes).toBe(200000);
    expect(warnMock).toHaveBeenCalledWith(
      'MAX_TEMPLATE_CONTENT_BYTES="999" invalid, using default 200000',
    );
  });

  it("rifiuta valori numerici con suffissi non validi", async () => {
    const { appConfig, warnMock } = await buildAppConfigWithEnv({
      MAX_TEMPLATE_CONTENT_BYTES: "1000abc",
    });

    expect(appConfig.maxTemplateContentBytes).toBe(200000);
    expect(warnMock).toHaveBeenCalledWith(
      'MAX_TEMPLATE_CONTENT_BYTES="1000abc" invalid, using default 200000',
    );
  });

  it("disabilita retention audit con valore zero o negativo", async () => {
    const zero = await buildAppConfigWithEnv({
      AUDIT_LOG_RETENTION_DAYS: "0",
    });
    expect(zero.appConfig.auditLogRetentionDays).toBeNull();

    const negative = await buildAppConfigWithEnv({
      AUDIT_LOG_RETENTION_DAYS: "-1",
    });
    expect(negative.appConfig.auditLogRetentionDays).toBeNull();
  });
});
