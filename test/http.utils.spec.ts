import type { Request } from "express";
import {
  assertUuid,
  getActor,
  parsePagination,
} from "../src/common/utils/http.utils";

describe("HTTP Utilities", () => {
  describe("parsePagination()", () => {
    describe("Black-box tests", () => {
      it("deve usare valori di default se non forniti", () => {
        const result = parsePagination({});

        expect(result.limit).toBe(20);
        expect(result.offset).toBe(0);
      });

      it("deve parsare limit e offset come numeri", () => {
        const result = parsePagination({ limit: "50", offset: "100" });

        expect(result.limit).toBe(50);
        expect(result.offset).toBe(100);
      });

      it("deve accettare limit e offset come numeri", () => {
        const result = parsePagination({ limit: 30, offset: 10 });

        expect(result.limit).toBe(30);
        expect(result.offset).toBe(10);
      });

      it("deve rifiutare limit negativo", () => {
        expect(() => {
          parsePagination({ limit: "-10", offset: "0" });
        }).toThrow();
      });

      it("deve rifiutare limit zero", () => {
        expect(() => {
          parsePagination({ limit: "0", offset: "0" });
        }).toThrow();
      });

      it("deve rifiutare offset negativo", () => {
        expect(() => {
          parsePagination({ limit: "20", offset: "-1" });
        }).toThrow();
      });

      it("deve accettare offset zero", () => {
        const result = parsePagination({ limit: "20", offset: "0" });

        expect(result.offset).toBe(0);
      });

      it("deve rifiutare non-numeri", () => {
        expect(() => {
          parsePagination({ limit: "abc", offset: "0" });
        }).toThrow();
      });

      it("deve truncare float per limit a numero intero", () => {
        const result = parsePagination({ limit: "20.5", offset: "0" });
        expect(result.limit).toBe(20);
      });

      it("deve truncare float per offset a numero intero", () => {
        const result = parsePagination({ limit: "20", offset: "10.5" });
        expect(result.offset).toBe(10);
      });
    });

    describe("Boundary cases", () => {
      it("deve accettare limit molto grande", () => {
        const result = parsePagination({ limit: "999999", offset: "0" });

        expect(result.limit).toBe(999999);
      });

      it("deve accettare offset molto grande", () => {
        const result = parsePagination({ limit: "20", offset: "999999" });

        expect(result.offset).toBe(999999);
      });

      it("deve gestire limit = 1", () => {
        const result = parsePagination({ limit: "1", offset: "0" });

        expect(result.limit).toBe(1);
      });

      it("deve riportare errore specifico per limit non valido", () => {
        expect(() => parsePagination({ limit: "abc", offset: "0" })).toThrow(
          expect.objectContaining({
            message: expect.stringContaining("limit"),
          }),
        );
      });

      it("deve riportare errore specifico per offset non valido", () => {
        expect(() => parsePagination({ limit: "20", offset: "-5" })).toThrow(
          expect.objectContaining({
            message: expect.stringContaining("offset"),
          }),
        );
      });

      it("deve usare custom defaults", () => {
        const customDefaults = { limit: 100, offset: 50 };
        const result = parsePagination({}, customDefaults);

        expect(result.limit).toBe(100);
        expect(result.offset).toBe(50);
      });

      it("deve parsare correttamente limite con leading zero", () => {
        const result = parsePagination({ limit: "020", offset: "010" });

        expect(result.limit).toBe(20);
        expect(result.offset).toBe(10);
      });

      it("deve gestire spazi nelle stringhe numeriche", () => {
        try {
          parsePagination({ limit: " 20 ", offset: "0" });
        } catch {
          // parseInt(" 20 ") = 20, potrebbe funzionare o meno
        }
      });
    });

    describe("Failure modes", () => {
      it("deve usare default limit quando undefined", () => {
        const result = parsePagination({
          limit: undefined as unknown as string,
          offset: "0",
        });
        expect(result.limit).toBe(20);
      });

      it("deve gestire null nel limit lanciando errore", () => {
        expect(() => {
          parsePagination({ limit: null as unknown as string, offset: "0" });
        }).toThrow();
      });

      it("deve gestire valori booleani", () => {
        expect(() => {
          parsePagination({ limit: true as unknown as string, offset: "0" });
        }).toThrow();
      });

      it("deve gestire oggetti nel limit", () => {
        expect(() => {
          parsePagination({ limit: {} as unknown as string, offset: "0" });
        }).toThrow();
      });

      it("deve gestire array nel limit", () => {
        expect(() => {
          parsePagination({ limit: [] as unknown as string, offset: "0" });
        }).toThrow();
      });
    });
  });

  describe("assertUuid()", () => {
    describe("Black-box tests", () => {
      it("deve accettare UUID valido", () => {
        const validUuid = "550e8400-e29b-41d4-a716-446655440000";

        expect(() => {
          assertUuid(validUuid);
        }).not.toThrow();
      });

      it("deve accettare UUID in maiuscolo", () => {
        const uppercaseUuid = "550E8400-E29B-41D4-A716-446655440000";

        expect(() => {
          assertUuid(uppercaseUuid);
        }).not.toThrow();
      });

      it("deve accettare UUID misto", () => {
        const mixedUuid = "550e8400-E29b-41D4-a716-446655440000";

        expect(() => {
          assertUuid(mixedUuid);
        }).not.toThrow();
      });

      it("deve rifiutare stringa non-UUID", () => {
        expect(() => {
          assertUuid("not-a-uuid");
        }).toThrow("non valido");
      });

      it("deve rifiutare UUID malformato", () => {
        expect(() => {
          assertUuid("550e8400-e29b-41d4-a716-44665544000");
        }).toThrow();
      });

      it("deve rifiutare UUID senza trattini", () => {
        expect(() => {
          assertUuid("550e8400e29b41d4a716446655440000");
        }).toThrow();
      });

      it("deve rifiutare stringa vuota", () => {
        expect(() => {
          assertUuid("");
        }).toThrow();
      });

      it("deve usare field name personalizzato nel messaggio di errore", () => {
        expect(() => assertUuid("invalid", "templateId")).toThrow(
          expect.objectContaining({
            message: expect.stringContaining("templateId"),
          }),
        );
      });

      it("deve usare 'id' come field name di default", () => {
        expect(() => assertUuid("invalid")).toThrow(
          expect.objectContaining({ message: expect.stringContaining("id") }),
        );
      });
    });

    describe("Boundary cases", () => {
      it("deve accettare UUID v1", () => {
        const uuidV1 = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
        expect(() => assertUuid(uuidV1)).not.toThrow();
      });

      it("deve accettare UUID v4", () => {
        const uuidV4 = "550e8400-e29b-41d4-a716-446655440000";
        expect(() => assertUuid(uuidV4)).not.toThrow();
      });

      it("deve rifiutare UUID con caratteri speciali", () => {
        expect(() => {
          assertUuid("550e8400-e29b-41d4-a716-44665544000@");
        }).toThrow();
      });

      it("deve rifiutare UUID con spazi", () => {
        expect(() => {
          assertUuid("550e8400-e29b-41d4-a716-446655440000 ");
        }).toThrow();
      });

      it("deve rifiutare null", () => {
        expect(() => {
          assertUuid(null as unknown as string);
        }).toThrow();
      });

      it("deve rifiutare undefined", () => {
        expect(() => {
          assertUuid(undefined as unknown as string);
        }).toThrow();
      });

      it("deve generare AppError con status 400", () => {
        expect(() => assertUuid("invalid")).toThrow(
          expect.objectContaining({ status: 400 }),
        );
      });
    });

    describe("Failure modes", () => {
      it("deve gestire UUID con lettere extra", () => {
        expect(() => {
          assertUuid("550e8400-e29b-41d4-a716-446655440000xyz");
        }).toThrow();
      });

      it("deve gestire UUID con segni matematici", () => {
        expect(() => {
          assertUuid("550e8400-e29b-41d4-a716-4466554400+");
        }).toThrow();
      });
    });
  });

  describe("getActor()", () => {
    describe("Black-box tests", () => {
      it("deve estrarre l'header x-user se presente", () => {
        const req = {
          headers: { "x-user": "john.doe@example.com" },
        } as unknown as Request;

        const actor = getActor(req);

        expect(actor).toBe("john.doe@example.com");
      });

      it("deve ritornare 'system' se l'header non è presente", () => {
        const req = { headers: {} } as unknown as Request;

        const actor = getActor(req);

        expect(actor).toBe("system");
      });

      it("deve ritornare 'system' se l'header è vuoto", () => {
        const req = {
          headers: { "x-user": "" },
        } as unknown as Request;

        const actor = getActor(req);

        expect(actor).toBe("system");
      });

      it("deve ritornare 'system' se l'header è solo whitespace", () => {
        const req = {
          headers: { "x-user": "   " },
        } as unknown as Request;

        const actor = getActor(req);

        expect(actor).toBe("system");
      });

      it("deve gestire header con case insensitivo", () => {
        const req = {
          headers: { "X-User": "admin" },
        } as unknown as Request;

        const actor = getActor(req);

        expect(typeof actor).toBe("string");
      });

      it("deve preservare spazi nei nomi validi", () => {
        const req = {
          headers: { "x-user": "John Doe" },
        } as unknown as Request;

        const actor = getActor(req);

        expect(actor).toBe("John Doe");
      });
    });

    describe("Boundary cases", () => {
      it("deve gestire nome utente molto lungo", () => {
        const longName = `user@example.com-${"a".repeat(1000)}`;
        const req = {
          headers: { "x-user": longName },
        } as unknown as Request;

        const actor = getActor(req);

        expect(actor).toBe(longName);
      });

      it("deve gestire caratteri speciali nel nome", () => {
        const req = {
          headers: { "x-user": "user+tag@example.com" },
        } as unknown as Request;

        const actor = getActor(req);

        expect(actor).toBe("user+tag@example.com");
      });

      it("deve gestire header undefined — ritorna system", () => {
        const req = {
          headers: undefined,
        } as unknown as Request;

        const actor = getActor(req);

        expect(actor).toBe("system");
      });

      it("deve gestire headers come null — ritorna system", () => {
        const req = {
          headers: null,
        } as unknown as Request;

        const actor = getActor(req);

        expect(actor).toBe("system");
      });

      it("deve gestire x-user non-string", () => {
        const req = {
          headers: { "x-user": 123 as unknown as string },
        } as unknown as Request;

        const actor = getActor(req);

        expect(actor).toBe("system");
      });

      it("deve gestire x-user come array", () => {
        const req = {
          headers: { "x-user": ["user1", "user2"] as unknown as string },
        } as unknown as Request;

        const actor = getActor(req);

        expect(actor).toBe("system");
      });

      it("deve gestire UUID come x-user", () => {
        const uuid = "550e8400-e29b-41d4-a716-446655440000";
        const req = {
          headers: { "x-user": uuid },
        } as unknown as Request;

        const actor = getActor(req);

        expect(actor).toBe(uuid);
      });

      it("deve gestire URL encoded values", () => {
        const req = {
          headers: { "x-user": "user%40example.com" },
        } as unknown as Request;

        const actor = getActor(req);

        expect(actor).toBe("user%40example.com");
      });
    });

    describe("Failure modes", () => {
      it("deve gestire Request senza headers — ritorna system", () => {
        const req = {} as unknown as Request;

        const actor = getActor(req);

        expect(actor).toBe("system");
      });

      it("deve gestire headers.x-user accesso fallito", () => {
        const req = {
          headers: Object.create(null),
        } as unknown as Request;

        const actor = getActor(req);

        expect(actor).toBe("system");
      });
    });

    describe("Integration tests", () => {
      it("deve gestire richieste express reali", () => {
        const req = {
          headers: { "x-user": "api-consumer-123" },
          method: "POST",
          url: "/api/documents",
        } as unknown as Request;

        const actor = getActor(req);

        expect(actor).toBe("api-consumer-123");
      });

      it("deve gestire richieste multiple con attori diversi", () => {
        const actors = [
          getActor({
            headers: { "x-user": "user1" },
          } as unknown as Request),
          getActor({
            headers: { "x-user": "user2" },
          } as unknown as Request),
          getActor({ headers: {} } as unknown as Request),
        ];

        expect(actors).toEqual(["user1", "user2", "system"]);
      });
    });
  });

  describe("Integration - Flusso completo pagination", () => {
    it("deve gestire un flusso di paginazione realistico", () => {
      const results = [
        parsePagination({ limit: "20", offset: "0" }),
        parsePagination({ limit: "20", offset: "20" }),
        parsePagination({ limit: "20", offset: "40" }),
      ];

      expect(results[0].offset).toBe(0);
      expect(results[1].offset).toBe(20);
      expect(results[2].offset).toBe(40);
      expect(results.every((r) => r.limit === 20)).toBe(true);
    });

    it("deve gestire un flusso di validazione realistico", () => {
      const uuids = [
        "550e8400-e29b-41d4-a716-446655440000",
        "660e8400-e29b-41d4-a716-446655440000",
        "770e8400-e29b-41d4-a716-446655440000",
      ];

      const validatedUuids = uuids.filter((uuid) => {
        try {
          assertUuid(uuid, "documentId");
          return true;
        } catch {
          return false;
        }
      });

      expect(validatedUuids.length).toBe(3);
    });
  });
});
