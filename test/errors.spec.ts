import { AppError, makeError } from "../src/common/utils/errors";

describe("Error Handling and AppError", () => {
  describe("makeError() - Black-box tests", () => {
    it("deve creare un AppError con status 400 di default", () => {
      const error = makeError("Test error");

      expect(error).toBeInstanceOf(AppError);
      expect(error.message).toBe("Test error");
      expect(error.status).toBe(400);
    });

    it("deve creare un AppError con status personalizzato", () => {
      const error = makeError("Not found", 404);

      expect(error.status).toBe(404);
      expect(error.message).toBe("Not found");
    });

    it("deve creare errori con status 500", () => {
      const error = makeError("Internal server error", 500);

      expect(error.status).toBe(500);
    });

    it("deve creare errori con status 401", () => {
      const error = makeError("Unauthorized", 401);

      expect(error.status).toBe(401);
    });

    it("deve creare errori con status 403", () => {
      const error = makeError("Forbidden", 403);

      expect(error.status).toBe(403);
    });

    it("deve conservare il nome errore", () => {
      const error = makeError("Test");

      expect(error.name).toBe("AppError");
    });

    it("deve essere istanza di Error", () => {
      const error = makeError("Test");

      expect(error).toBeInstanceOf(Error);
    });

    it("deve avere stack trace", () => {
      const error = makeError("Test");

      expect(error.stack).toBeDefined();
    });
  });

  describe("makeError() - Boundary cases", () => {
    it("deve gestire messaggi di errore vuoti", () => {
      const error = makeError("");

      expect(error.message).toBe("");
    });

    it("deve gestire messaggi molto lunghi", () => {
      const longMessage = "A".repeat(10000);
      const error = makeError(longMessage, 400);

      expect(error.message).toBe(longMessage);
    });

    it("deve gestire status number 0", () => {
      const error = makeError("Error", 0);

      expect(error.status).toBe(0);
    });

    it("deve gestire status number negativo", () => {
      const error = makeError("Error", -1);

      expect(error.status).toBe(-1);
    });

    it("deve gestire status number molto grande", () => {
      const error = makeError("Error", 999);

      expect(error.status).toBe(999);
    });

    it("deve gestire messaggi con caratteri speciali", () => {
      const message = "Errore: @#$%^&*() 中文 العربية";
      const error = makeError(message, 400);

      expect(error.message).toBe(message);
    });

    it("deve gestire messaggi multiriga", () => {
      const message = "Line 1\nLine 2\nLine 3";
      const error = makeError(message, 400);

      expect(error.message).toBe(message);
    });
  });

  describe("AppError constructor", () => {
    it("deve costruire AppError direttamente", () => {
      const error = new AppError("Direct error", 422);

      expect(error.message).toBe("Direct error");
      expect(error.status).toBe(422);
    });

    it("deve avere proprietà name corretta", () => {
      const error = new AppError("Test");

      expect(error.name).toBe("AppError");
    });

    it("deve ereditare da Error", () => {
      const error = new AppError("Test");

      expect(error instanceof Error).toBe(true);
    });

    it("deve supportare il throw e catch", () => {
      try {
        throw new AppError("Throwable error", 400);
      } catch (e) {
        const error = e as AppError;
        expect(error.message).toBe("Throwable error");
        expect(error.status).toBe(400);
      }
    });
  });

  describe("AppError - HTTP status codes coverage", () => {
    const httpStatuses = [
      { code: 200, scenario: "Success (should not be used for errors)" },
      { code: 201, scenario: "Created" },
      { code: 204, scenario: "No Content" },
      { code: 300, scenario: "Multiple Choices" },
      { code: 301, scenario: "Moved Permanently" },
      { code: 302, scenario: "Found" },
      { code: 304, scenario: "Not Modified" },
      { code: 400, scenario: "Bad Request" },
      { code: 401, scenario: "Unauthorized" },
      { code: 403, scenario: "Forbidden" },
      { code: 404, scenario: "Not Found" },
      { code: 409, scenario: "Conflict" },
      { code: 422, scenario: "Unprocessable Entity" },
      { code: 500, scenario: "Internal Server Error" },
      { code: 501, scenario: "Not Implemented" },
      { code: 502, scenario: "Bad Gateway" },
      { code: 503, scenario: "Service Unavailable" },
    ];

    httpStatuses.forEach(({ code, scenario }) => {
      it(`deve supportare status ${code} (${scenario})`, () => {
        const error = makeError(scenario, code);
        expect(error.status).toBe(code);
      });
    });
  });

  describe("Error handling in services - Integration scenarios", () => {
    it("deve propagare errori da makeError in catch", async () => {
      const throwError = async () => {
        throw makeError("Service error", 500);
      };

      await expect(throwError()).rejects.toMatchObject({
        message: "Service error",
        status: 500,
      });
    });

    it("deve catturare e rethrow con status diverso", async () => {
      const action = async () => {
        throw makeError("Wrapped error", 400);
      };

      await expect(action()).rejects.toMatchObject({
        message: "Wrapped error",
        status: 400,
      });
    });

    it("deve gestire chain di errori", () => {
      const action = () => {
        throw makeError("Wrapped error", 400);
      };

      expect(action).toThrow(
        expect.objectContaining({
          message: "Wrapped error",
          status: 400,
        }),
      );
    });
  });

  describe("Error messages in real scenarios", () => {
    const scenarios = [
      {
        situation: "Documento non trovato",
        message: "Documento non trovato",
        status: 404,
      },
      {
        situation: "Template not found",
        message: "Template not found",
        status: 404,
      },
      {
        situation: "Nome documento obbligatorio",
        message: "Il nome documento e obbligatorio",
        status: 400,
      },
      {
        situation: "UUID invalid",
        message: "id invalid: must be a UUID",
        status: 400,
      },
      {
        situation: "Limit invalid",
        message: "invalid limit",
        status: 400,
      },
      {
        situation: "Offset invalid",
        message: "invalid offset",
        status: 400,
      },
      {
        situation: "FieldValues non oggetto",
        message: "fieldValues must be an object",
        status: 400,
      },
      {
        situation: "Contenuto template vuoto",
        message: "Template content cannot be empty",
        status: 400,
      },
    ];

    scenarios.forEach(({ situation, message, status }) => {
      it(`deve gestire il caso: ${situation}`, () => {
        const error = makeError(message, status);

        expect(error.message).toBe(message);
        expect(error.status).toBe(status);
      });
    });
  });

  describe("Error filtering and transformation", () => {
    it("deve preservare errori con status 4xx", () => {
      const error = makeError("Validation error", 422);

      expect(error.status).toBeGreaterThanOrEqual(400);
      expect(error.status).toBeLessThan(500);
    });

    it("deve preservare errori con status 5xx", () => {
      const error = makeError("Server error", 500);

      expect(error.status).toBeGreaterThanOrEqual(500);
      expect(error.status).toBeLessThan(600);
    });

    it("deve identificare errori client", () => {
      const errors = [
        makeError("Bad request", 400),
        makeError("Unauthorized", 401),
        makeError("Not found", 404),
      ];

      const isClientError = (e: AppError) => e.status >= 400 && e.status < 500;

      expect(errors.every(isClientError)).toBe(true);
    });

    it("deve identificare errori server", () => {
      const errors = [
        makeError("Internal error", 500),
        makeError("Service unavailable", 503),
      ];

      const isServerError = (e: AppError) => e.status >= 500;

      expect(errors.every(isServerError)).toBe(true);
    });
  });

  describe("AppError as HTTP exception", () => {
    it("deve avere proprietà per middleware express", () => {
      const error = makeError("Error", 404);

      expect(error).toHaveProperty("message");
      expect(error).toHaveProperty("status");
      expect(error).toHaveProperty("name");
    });

    it("deve supportare JSON serialization parziale", () => {
      const error = makeError("Error", 404);

      const json = JSON.stringify(error);

      expect(typeof json).toBe("string");
    });

    it("deve permettere conversione a stringa", () => {
      const error = makeError("Test error", 404);

      const str = String(error);

      expect(str).toContain("Error");
    });
  });

  describe("Error comparison and equality", () => {
    it("deve distinguere errori con status diversi", () => {
      const error1 = makeError("Error", 400);
      const error2 = makeError("Error", 404);

      expect(error1.status).not.toBe(error2.status);
    });

    it("deve distinguere errori con messaggi diversi", () => {
      const error1 = makeError("Error 1", 400);
      const error2 = makeError("Error 2", 400);

      expect(error1.message).not.toBe(error2.message);
    });

    it("deve identificare errori identici", () => {
      const error1 = makeError("Error", 404);
      const error2 = makeError("Error", 404);

      expect(error1.message).toBe(error2.message);
      expect(error1.status).toBe(error2.status);
    });
  });

  describe("Error handling performance", () => {
    it("deve creare errori velocemente", () => {
      const start = performance.now();

      for (let i = 0; i < 10000; i++) {
        makeError("Error", 400);
      }

      const end = performance.now();
      const duration = end - start;

      // Soglia generosa: 10k istanze AppError su qualsiasi macchina/CI devono stare sotto 1s
      expect(duration).toBeLessThan(1000);
    });

    it("deve gestire creazione massiccia di errori", () => {
      const errors = new Array(1000)
        .fill(0)
        .map((_, i) => makeError(`Error ${i}`, 400 + (i % 100)));

      expect(errors.length).toBe(1000);
      expect(errors.every((e) => e instanceof AppError)).toBe(true);
    });
  });

  describe("Edge case - unusual status codes", () => {
    it("deve gestire status code personalizzati", () => {
      const error = makeError("Custom error", 418);

      expect(error.status).toBe(418);
    });

    it("deve gestire status code 100", () => {
      const error = makeError("Continue", 100);

      expect(error.status).toBe(100);
    });

    it("deve gestire status code 599", () => {
      const error = makeError("Custom error", 599);

      expect(error.status).toBe(599);
    });
  });
});
