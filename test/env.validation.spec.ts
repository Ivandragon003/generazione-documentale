import { validateEnv } from "../src/config/env.validation";

const baseEnv = {
  DB_HOST: "localhost",
  DB_PORT: "5432",
  DB_USER: "postgres",
  DB_PASSWORD: "postgres",
  DB_NAME: "mac_documents",
  PORT: "3000",
};

describe("validateEnv", () => {
  it("accetta development senza PDF_SERVICE_URL", () => {
    const result = validateEnv({
      ...baseEnv,
      NODE_ENV: "development",
    });
    expect(result.NODE_ENV).toBe("development");
    expect(result.PDF_SERVICE_URL).toBe("");
  });

  it("rifiuta production senza PDF_SERVICE_URL", () => {
    expect(() =>
      validateEnv({
        ...baseEnv,
        NODE_ENV: "production",
        PDF_SERVICE_URL: "",
      }),
    ).toThrow(/PDF_SERVICE_URL/);
  });

  it("accetta production con PDF_SERVICE_URL", () => {
    const result = validateEnv({
      ...baseEnv,
      NODE_ENV: "production",
      PDF_SERVICE_URL: "http://pdf-service:3100",
      ENABLE_LOCAL_PDF_FALLBACK: "false",
    });
    expect(result.NODE_ENV).toBe("production");
    expect(result.PDF_SERVICE_URL).toBe("http://pdf-service:3100");
  });
});
