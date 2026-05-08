import { Test, type TestingModule } from "@nestjs/testing";
import type { FieldDefinition } from "../src/common/types/field-definition.type";
import { DocumentRenderingService } from "../src/service/document-rendering.service";

describe("DocumentRenderingService", () => {
  let service: DocumentRenderingService;

  beforeEach(async () => {
    jest.spyOn(console, "warn").mockImplementation(() => {});

    const module: TestingModule = await Test.createTestingModule({
      providers: [DocumentRenderingService],
    }).compile();

    service = module.get<DocumentRenderingService>(DocumentRenderingService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("renderTemplate() - Black-box tests", () => {
    it("deve renderizzare template con placeholder risolti", () => {
      const content = "Titolo: {{titolo}}, Cliente: {{cliente}}";
      const fieldValues = { titolo: "Contratto", cliente: "Mario Rossi" };

      const result = service.renderTemplate(content, fieldValues, false);

      expect(result.result).toBe("Titolo: Contratto, Cliente: Mario Rossi");
      expect(result.unresolved).toEqual([]);
    });

    it("deve identificare placeholder non risolti", () => {
      const content = "Titolo: {{titolo}}, Cliente: {{cliente}}";
      const fieldValues = { titolo: "Contratto" };

      const result = service.renderTemplate(content, fieldValues, false);

      expect(result.result).toContain("{{cliente}}");
      expect(result.unresolved).toContain("cliente");
    });

    it("deve gestire strict mode rimuovendo placeholder non risolti", () => {
      const content = "Titolo: {{titolo}}, Cliente: {{cliente}}";
      const fieldValues = { titolo: "Contratto" };

      const result = service.renderTemplate(content, fieldValues, true);

      expect(result.result).toBe("Titolo: Contratto, Cliente: ");
      expect(result.unresolved).toContain("cliente");
    });

    it("deve gestire valori null come non risolti", () => {
      const content = "Cliente: {{cliente}}";
      const fieldValues = { cliente: null };

      const result = service.renderTemplate(content, fieldValues, false);

      expect(result.result).toBe("Cliente: {{cliente}}");
      expect(result.unresolved).toContain("cliente");
    });

    it("deve gestire stringhe vuote come non risolte", () => {
      const content = "Cliente: {{cliente}}";
      const fieldValues = { cliente: "" };

      const result = service.renderTemplate(content, fieldValues, false);

      expect(result.result).toBe("Cliente: {{cliente}}");
      expect(result.unresolved).toContain("cliente");
    });

    it("deve convertire numeri a stringhe", () => {
      const content = "Importo: {{importo}} euro";
      const fieldValues = { importo: 1500 };

      const result = service.renderTemplate(content, fieldValues, false);

      expect(result.result).toBe("Importo: 1500 euro");
      expect(result.unresolved).toEqual([]);
    });

    it("deve convertire boolean a stringhe", () => {
      const content = "Scaduto: {{scaduto}}";
      const fieldValues = { scaduto: true };

      const result = service.renderTemplate(content, fieldValues, false);

      expect(result.result).toBe("Scaduto: true");
      expect(result.unresolved).toEqual([]);
    });

    it("deve gestire template senza placeholder", () => {
      const content = "Nessun placeholder qui";
      const fieldValues = {};

      const result = service.renderTemplate(content, fieldValues, false);

      expect(result.result).toBe("Nessun placeholder qui");
      expect(result.unresolved).toEqual([]);
    });

    it("deve gestire content vuoto", () => {
      const content = "";
      const fieldValues = { titolo: "Test" };

      const result = service.renderTemplate(content, fieldValues, false);

      expect(result.result).toBe("");
      expect(result.unresolved).toEqual([]);
    });

    it("deve gestire placeholder con whitespace", () => {
      const content = "Titolo: {{ titolo }}, Client: {{  cliente  }}";
      const fieldValues = { titolo: "Test", cliente: "Mario" };

      const result = service.renderTemplate(content, fieldValues, false);

      expect(result.result).toBe("Titolo: Test, Client: Mario");
      expect(result.unresolved).toEqual([]);
    });
  });

  describe("renderTemplate() - Boundary cases", () => {
    it("deve gestire placeholder ripetuti", () => {
      const content = "{{campo}} è {{campo}}";
      const fieldValues = { campo: "importante" };

      const result = service.renderTemplate(content, fieldValues, false);

      expect(result.result).toBe("importante è importante");
      expect(result.unresolved).toEqual([]);
    });

    it("deve gestire placeholder non documentati", () => {
      const content = "Nome: {{nome}}, Cognome: {{cognome}}";
      const fieldValues = {
        nome: "Mario",
        cognome: "Rossi",
        extra: "ignorato",
      };

      const result = service.renderTemplate(content, fieldValues, false);

      expect(result.result).toBe("Nome: Mario, Cognome: Rossi");
      expect(result.unresolved).toEqual([]);
    });

    it("deve gestire placeholder annidati non validi", () => {
      const content = "Test: {{campo1{{campo2}}}}";
      const fieldValues = { campo1: "value1" };

      const result = service.renderTemplate(content, fieldValues, false);

      expect(result.unresolved.length).toBeGreaterThanOrEqual(0);
    });

    it("deve gestire lunghe stringhe di campo", () => {
      const longValue = "A".repeat(10000);
      const content = "Valore: {{campo}}";
      const fieldValues = { campo: longValue };

      const result = service.renderTemplate(content, fieldValues, false);

      expect(result.result).toBe(`Valore: ${longValue}`);
      expect(result.unresolved).toEqual([]);
    });

    it("deve gestire zero come valore valido", () => {
      const content = "Importo: {{importo}}";
      const fieldValues = { importo: 0 };

      const result = service.renderTemplate(content, fieldValues, false);

      expect(result.result).toBe("Importo: 0");
      expect(result.unresolved).toEqual([]);
    });

    it("deve gestire false come valore valido", () => {
      const content = "Attivo: {{attivo}}";
      const fieldValues = { attivo: false };

      const result = service.renderTemplate(content, fieldValues, false);

      expect(result.result).toBe("Attivo: false");
      expect(result.unresolved).toEqual([]);
    });

    it("deve gestire molti placeholder", () => {
      const placeholders = new Array(100)
        .fill(0)
        .map((_, i) => `{{campo${i}}}`)
        .join(" ");
      const fieldValues = Object.fromEntries(
        new Array(100)
          .fill(0)
          .map((_, i) => [`campo${i}`, `value${i}`]),
      );

      const result = service.renderTemplate(placeholders, fieldValues, false);

      expect(result.unresolved).toEqual([]);
    });
  });

  describe("renderTemplate() - Strict mode edge cases", () => {
    it("deve rimuovere placeholder non risolti in strict mode", () => {
      const content = "Inizio {{campo1}} Mezzo {{campo2}} Fine";
      const fieldValues = { campo1: "A" };

      const result = service.renderTemplate(content, fieldValues, true);

      expect(result.result).toBe("Inizio A Mezzo  Fine");
      expect(result.unresolved).toContain("campo2");
    });

    it("deve gestire tutti i placeholder non risolti in strict mode", () => {
      const content = "{{a}} {{b}} {{c}}";
      const fieldValues = {};

      const result = service.renderTemplate(content, fieldValues, true);

      expect(result.result).toBe("  ");
      expect(result.unresolved).toEqual(["a", "b", "c"]);
    });
  });

  describe("getMissingRequiredFields() - Black-box tests", () => {
    it("deve identificare campi obbligatori mancanti", () => {
      const fields: FieldDefinition[] = [
        {
          name: "titolo",
          label: "Titolo",
          type: "text",
          required: true,
          defaultValue: "",
        },
        {
          name: "cliente",
          label: "Cliente",
          type: "text",
          required: true,
          defaultValue: "",
        },
      ];
      const fieldValues = { titolo: "Test" };

      const missing = service.getMissingRequiredFields(fields, fieldValues);

      expect(missing).toContain("Cliente");
      expect(missing).not.toContain("Titolo");
    });

    it("deve restituire lista vuota se tutti i campi obbligatori sono presenti", () => {
      const fields: FieldDefinition[] = [
        {
          name: "titolo",
          label: "Titolo",
          type: "text",
          required: true,
          defaultValue: "",
        },
      ];
      const fieldValues = { titolo: "Test" };

      const missing = service.getMissingRequiredFields(fields, fieldValues);

      expect(missing).toEqual([]);
    });

    it("deve ignorare campi non obbligatori mancanti", () => {
      const fields: FieldDefinition[] = [
        {
          name: "titolo",
          label: "Titolo",
          type: "text",
          required: true,
          defaultValue: "",
        },
        {
          name: "nota",
          label: "Nota",
          type: "text",
          required: false,
          defaultValue: "",
        },
      ];
      const fieldValues = { titolo: "Test" };

      const missing = service.getMissingRequiredFields(fields, fieldValues);

      expect(missing).toEqual([]);
    });

    it("deve gestire stringhe vuote come valori mancanti", () => {
      const fields: FieldDefinition[] = [
        {
          name: "titolo",
          label: "Titolo",
          type: "text",
          required: true,
          defaultValue: "",
        },
      ];
      const fieldValues = { titolo: "" };

      const missing = service.getMissingRequiredFields(fields, fieldValues);

      expect(missing).toContain("Titolo");
    });

    it("deve gestire null come valore mancante", () => {
      const fields: FieldDefinition[] = [
        {
          name: "titolo",
          label: "Titolo",
          type: "text",
          required: true,
          defaultValue: "",
        },
      ];
      const fieldValues = { titolo: null };

      const missing = service.getMissingRequiredFields(fields, fieldValues);

      expect(missing).toContain("Titolo");
    });

    it("deve gestire undefined come valore mancante", () => {
      const fields: FieldDefinition[] = [
        {
          name: "titolo",
          label: "Titolo",
          type: "text",
          required: true,
          defaultValue: "",
        },
      ];
      const fieldValues = {};

      const missing = service.getMissingRequiredFields(fields, fieldValues);

      expect(missing).toContain("Titolo");
    });

    it("deve usare il campo name se label non è disponibile", () => {
      const fields: FieldDefinition[] = [
        {
          name: "campo_test",
          label: undefined as unknown as string,
          type: "text",
          required: true,
          defaultValue: "",
        },
      ];
      const fieldValues = {};

      const missing = service.getMissingRequiredFields(fields, fieldValues);

      expect(missing).toContain("campo_test");
    });

    it("deve gestire lista vuota di campi", () => {
      const fields: FieldDefinition[] = [];
      const fieldValues = { qualsiasi: "valore" };

      const missing = service.getMissingRequiredFields(fields, fieldValues);

      expect(missing).toEqual([]);
    });

    it("deve gestire campi con required=false esplicitamente", () => {
      const fields: FieldDefinition[] = [
        {
          name: "nota",
          label: "Nota",
          type: "text",
          required: false,
          defaultValue: "",
        },
      ];
      const fieldValues = {};

      const missing = service.getMissingRequiredFields(fields, fieldValues);

      expect(missing).toEqual([]);
    });
  });

  describe("getMissingRequiredFields() - Boundary cases", () => {
    it("deve gestire zero come valore valido", () => {
      const fields: FieldDefinition[] = [
        {
          name: "importo",
          label: "Importo",
          type: "number",
          required: true,
          defaultValue: "",
        },
      ];
      const fieldValues = { importo: 0 };

      const missing = service.getMissingRequiredFields(fields, fieldValues);

      expect(missing).toEqual([]);
    });

    it("deve gestire false come valore valido", () => {
      const fields: FieldDefinition[] = [
        {
          name: "scaduto",
          label: "Scaduto",
          type: "boolean",
          required: true,
          defaultValue: "",
        },
      ];
      const fieldValues = { scaduto: false };

      const missing = service.getMissingRequiredFields(fields, fieldValues);

      expect(missing).toEqual([]);
    });

    it("deve gestire molti campi obbligatori", () => {
      const fields: FieldDefinition[] = new Array(100)
        .fill(0)
        .map((_, i) => ({
          name: `campo${i}`,
          label: `Campo ${i}`,
          type: "text" as const,
          required: i % 2 === 0,
          defaultValue: "",
        }));
      const fieldValues = Object.fromEntries(
        new Array(100)
          .fill(0)
          .map((_, i) => (i % 2 !== 0 ? [`campo${i}`, `value${i}`] : []))
          .filter((x) => x.length > 0),
      );

      const missing = service.getMissingRequiredFields(fields, fieldValues);

      expect(missing.length).toBe(50);
    });
  });
});
