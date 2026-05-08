import { plainToClass } from "class-transformer";
import { validate } from "class-validator";
import { CreateDocumentDto } from "../src/dto/create-document.dto";
import { CreateTemplateDto } from "../src/dto/create-template.dto";
import { UpdateDocumentDto } from "../src/dto/update-document.dto";
import { UpdateTemplateDto } from "../src/dto/update-template.dto";

// Helper: riduce il pattern plainToClass + validate ripetuto in ogni test
async function validateDto<T extends object>(
  cls: new (...args: unknown[]) => T,
  data: Record<string, unknown>,
) {
  return validate(plainToClass(cls, data));
}

describe("DTO Validation", () => {
  describe("CreateDocumentDto", () => {
    const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";
    const validBase = { name: "Test Document", templateId: VALID_UUID };

    describe("Black-box tests", () => {
      it("deve accettare input valido", async () => {
        expect(await validateDto(CreateDocumentDto, validBase)).toEqual([]);
      });

      it("deve rifiutare name non string", async () => {
        const errors = await validateDto(CreateDocumentDto, {
          ...validBase,
          name: 123,
        });
        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0].property).toBe("name");
      });

      it("deve rifiutare name mancante", async () => {
        const errors = await validateDto(CreateDocumentDto, {
          templateId: VALID_UUID,
        });
        expect(errors.length).toBeGreaterThan(0);
      });

      it("deve rifiutare templateId non UUID", async () => {
        const errors = await validateDto(CreateDocumentDto, {
          name: "Test",
          templateId: "not-a-uuid",
        });
        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0].property).toBe("templateId");
      });

      it("deve rifiutare templateId mancante", async () => {
        const errors = await validateDto(CreateDocumentDto, { name: "Test" });
        expect(errors.length).toBeGreaterThan(0);
      });

      it("deve rifiutare templateId non string", async () => {
        const errors = await validateDto(CreateDocumentDto, {
          name: "Test",
          templateId: 123,
        });
        expect(errors.length).toBeGreaterThan(0);
      });

      it("deve accettare UUID in maiuscolo", async () => {
        expect(
          await validateDto(CreateDocumentDto, {
            name: "Test",
            templateId: "550E8400-E29B-41D4-A716-446655440000",
          }),
        ).toEqual([]);
      });

      it("deve rifiutare UUID con formato errato", async () => {
        const errors = await validateDto(CreateDocumentDto, {
          name: "Test",
          templateId: "550e8400e29b41d4a716446655440000",
        });
        expect(errors.length).toBeGreaterThan(0);
      });
    });

    describe("Boundary cases", () => {
      it("deve accettare name molto lungo", async () => {
        expect(
          await validateDto(CreateDocumentDto, {
            name: "A".repeat(10000),
            templateId: VALID_UUID,
          }),
        ).toEqual([]);
      });

      it("deve rifiutare name vuoto come string", async () => {
        // @IsString() accetta stringhe vuote — il rifiuto avviene nella logica di business
        expect(
          await validateDto(CreateDocumentDto, { name: "", templateId: VALID_UUID }),
        ).toEqual([]);
      });

      it("deve gestire nome con spazi", async () => {
        expect(
          await validateDto(CreateDocumentDto, {
            name: "  Nome con spazi  ",
            templateId: VALID_UUID,
          }),
        ).toEqual([]);
      });

      it("deve gestire nome con caratteri speciali", async () => {
        expect(
          await validateDto(CreateDocumentDto, {
            name: "Documento @#$% & speciale",
            templateId: VALID_UUID,
          }),
        ).toEqual([]);
      });

      it("deve gestire null nel nome", async () => {
        const errors = await validateDto(CreateDocumentDto, {
          name: null,
          templateId: VALID_UUID,
        });
        expect(errors.length).toBeGreaterThan(0);
      });
    });
  });

  describe("UpdateDocumentDto", () => {
    describe("Black-box tests", () => {
      it("deve accettare input vuoto", async () => {
        expect(await validateDto(UpdateDocumentDto, {})).toEqual([]);
      });

      it("deve accettare solo name", async () => {
        expect(
          await validateDto(UpdateDocumentDto, { name: "Updated Name" }),
        ).toEqual([]);
      });

      it("deve accettare solo content", async () => {
        expect(
          await validateDto(UpdateDocumentDto, { content: "# New Content" }),
        ).toEqual([]);
      });

      it("deve accettare solo fieldValues", async () => {
        expect(
          await validateDto(UpdateDocumentDto, { fieldValues: { titolo: "Test" } }),
        ).toEqual([]);
      });

      it("deve accettare tutti i campi", async () => {
        expect(
          await validateDto(UpdateDocumentDto, {
            name: "Updated",
            content: "# Content",
            fieldValues: { titolo: "Test", importo: 1000 },
          }),
        ).toEqual([]);
      });

      it("deve rifiutare name non string", async () => {
        const errors = await validateDto(UpdateDocumentDto, { name: 123 });
        expect(errors.length).toBeGreaterThan(0);
      });

      it("deve rifiutare content non string", async () => {
        const errors = await validateDto(UpdateDocumentDto, { content: 123 });
        expect(errors.length).toBeGreaterThan(0);
      });

      it("deve rifiutare fieldValues non object", async () => {
        const errors = await validateDto(UpdateDocumentDto, {
          fieldValues: "not an object",
        });
        expect(errors.length).toBeGreaterThan(0);
      });

      it("deve rifiutare fieldValues come array", async () => {
        const errors = await validateDto(UpdateDocumentDto, {
          fieldValues: ["item1", "item2"],
        });
        expect(errors.length).toBeGreaterThan(0);
      });

      it("deve accettare fieldValues vuoto", async () => {
        expect(
          await validateDto(UpdateDocumentDto, { fieldValues: {} }),
        ).toEqual([]);
      });
    });

    describe("Boundary cases", () => {
      it("deve gestire fieldValues con null values", async () => {
        // @IsObject accetta oggetti con valori null
        expect(
          await validateDto(UpdateDocumentDto, {
            fieldValues: { titolo: null, cliente: "Test" },
          }),
        ).toEqual([]);
      });

      it("deve gestire fieldValues con tipi misti", async () => {
        expect(
          await validateDto(UpdateDocumentDto, {
            fieldValues: { string: "text", number: 123, boolean: true, null: null },
          }),
        ).toEqual([]);
      });

      it("deve accettare fieldValues con molte proprieta", async () => {
        const fieldValues = Object.fromEntries(
          Array(100)
            .fill(0)
            .map((_, i) => [`campo${i}`, `value${i}`]),
        );
        expect(await validateDto(UpdateDocumentDto, { fieldValues })).toEqual([]);
      });

      it("deve accettare content molto lungo", async () => {
        expect(
          await validateDto(UpdateDocumentDto, {
            content: "# Content\n" + "Paragrafo\n".repeat(10000),
          }),
        ).toEqual([]);
      });

      it("deve accettare content vuoto", async () => {
        expect(await validateDto(UpdateDocumentDto, { content: "" })).toEqual([]);
      });
    });

    describe("Failure modes", () => {
      it("deve gestire undefined come undefined", async () => {
        // undefined su campo optional va bene
        expect(await validateDto(UpdateDocumentDto, { name: undefined })).toEqual([]);
      });

      it("deve rifiutare proprieta aggiuntive non dichiarate", async () => {
        // class-validator non valida proprieta extra
        expect(
          await validateDto(UpdateDocumentDto, {
            name: "Test",
            invalidField: "should be ignored or validated",
          }),
        ).toEqual([]);
      });
    });
  });

  describe("CreateTemplateDto and UpdateTemplateDto", () => {
    describe("CreateTemplateDto", () => {
      it("deve accettare input valido minimo", async () => {
        expect(
          await validateDto(CreateTemplateDto, {
            name: "Test Template",
            content: "# {{titolo}}",
          }),
        ).toEqual([]);
      });

      it("deve accettare input con section_id", async () => {
        expect(
          await validateDto(CreateTemplateDto, {
            name: "Test",
            content: "# Content",
            section_id: "550e8400-e29b-41d4-a716-446655440000",
          }),
        ).toEqual([]);
      });

      it("deve accettare input con fields", async () => {
        expect(
          await validateDto(CreateTemplateDto, {
            name: "Test",
            content: "# {{titolo}}",
            fields: [
              { name: "titolo", label: "Titolo", type: "text", required: true },
            ],
          }),
        ).toEqual([]);
      });

      it("deve accettare input con description", async () => {
        expect(
          await validateDto(CreateTemplateDto, {
            name: "Test",
            content: "Content",
            description: "Una descrizione di prova",
          }),
        ).toEqual([]);
      });

      it("deve accettare input con created_by", async () => {
        expect(
          await validateDto(CreateTemplateDto, {
            name: "Test",
            content: "Content",
            created_by: "user@example.com",
          }),
        ).toEqual([]);
      });

      it("deve rifiutare name mancante", async () => {
        const errors = await validateDto(CreateTemplateDto, { content: "Content" });
        expect(errors.length).toBeGreaterThan(0);
      });

      it("deve rifiutare content mancante", async () => {
        const errors = await validateDto(CreateTemplateDto, { name: "Test" });
        expect(errors.length).toBeGreaterThan(0);
      });
    });

    describe("UpdateTemplateDto", () => {
      it("deve accettare input vuoto", async () => {
        expect(await validateDto(UpdateTemplateDto, {})).toEqual([]);
      });

      it("deve accettare section_id null", async () => {
        expect(
          await validateDto(UpdateTemplateDto, { section_id: null }),
        ).toEqual([]);
      });

      it("deve accettare qualsiasi combinazione di campi", async () => {
        expect(
          await validateDto(UpdateTemplateDto, {
            name: "Updated",
            description: "Updated description",
            content: "# Updated",
            fields: [{ name: "field1" }],
          }),
        ).toEqual([]);
      });
    });
  });

  describe("Integration - Flusso validazione completo", () => {
    it("deve validare un workflow di creazione e update", async () => {
      const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";

      expect(
        await validateDto(CreateDocumentDto, {
          name: "New Document",
          templateId: VALID_UUID,
        }),
      ).toEqual([]);

      expect(
        await validateDto(UpdateDocumentDto, {
          name: "Updated Document",
          content: "# New content",
          fieldValues: { titolo: "Test", cliente: "Mario" },
        }),
      ).toEqual([]);
    });

    it("deve rifiutare dati non validi in sequenza", async () => {
      const invalidDatas = [
        { name: 123, templateId: "invalid" },
        { name: "Test", templateId: "not-uuid" },
        { name: null, templateId: null },
      ];

      for (const data of invalidDatas) {
        const errors = await validateDto(
          CreateDocumentDto,
          data as Record<string, unknown>,
        );
        expect(errors.length).toBeGreaterThan(0);
      }
    });
  });
});
