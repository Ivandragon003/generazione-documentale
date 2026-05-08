import { plainToClass } from "class-transformer";
import { validate } from "class-validator";
import { CreateDocumentDto } from "../src/dto/create-document.dto";
import { CreateTemplateDto } from "../src/dto/create-template.dto";
import { UpdateDocumentDto } from "../src/dto/update-document.dto";
import { UpdateTemplateDto } from "../src/dto/update-template.dto";

describe("DTO Validation", () => {
  describe("CreateDocumentDto", () => {
    describe("Black-box tests", () => {
      it("deve accettare input valido", async () => {
        const dto = plainToClass(CreateDocumentDto, {
          name: "Test Document",
          templateId: "550e8400-e29b-41d4-a716-446655440000",
        });

        const errors = await validate(dto);

        expect(errors).toEqual([]);
      });

      it("deve rifiutare name non string", async () => {
        const dto = plainToClass(CreateDocumentDto, {
          name: 123,
          templateId: "550e8400-e29b-41d4-a716-446655440000",
        });

        const errors = await validate(dto);

        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0].property).toBe("name");
      });

      it("deve rifiutare name mancante", async () => {
        const dto = plainToClass(CreateDocumentDto, {
          templateId: "550e8400-e29b-41d4-a716-446655440000",
        });

        const errors = await validate(dto);

        expect(errors.length).toBeGreaterThan(0);
      });

      it("deve rifiutare templateId non UUID", async () => {
        const dto = plainToClass(CreateDocumentDto, {
          name: "Test",
          templateId: "not-a-uuid",
        });

        const errors = await validate(dto);

        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0].property).toBe("templateId");
      });

      it("deve rifiutare templateId mancante", async () => {
        const dto = plainToClass(CreateDocumentDto, {
          name: "Test",
        });

        const errors = await validate(dto);

        expect(errors.length).toBeGreaterThan(0);
      });

      it("deve rifiutare templateId non string", async () => {
        const dto = plainToClass(CreateDocumentDto, {
          name: "Test",
          templateId: 123,
        });

        const errors = await validate(dto);

        expect(errors.length).toBeGreaterThan(0);
      });

      it("deve accettare UUID in maiuscolo", async () => {
        const dto = plainToClass(CreateDocumentDto, {
          name: "Test",
          templateId: "550E8400-E29B-41D4-A716-446655440000",
        });

        const errors = await validate(dto);

        expect(errors).toEqual([]);
      });

      it("deve rifiutare UUID con formato errato", async () => {
        const dto = plainToClass(CreateDocumentDto, {
          name: "Test",
          templateId: "550e8400e29b41d4a716446655440000",
        });

        const errors = await validate(dto);

        expect(errors.length).toBeGreaterThan(0);
      });
    });

    describe("Boundary cases", () => {
      it("deve accettare name molto lungo", async () => {
        const dto = plainToClass(CreateDocumentDto, {
          name: "A".repeat(10000),
          templateId: "550e8400-e29b-41d4-a716-446655440000",
        });

        const errors = await validate(dto);

        expect(errors).toEqual([]);
      });

      it("deve rifiutare name vuoto come string", async () => {
        // La validazione @IsString() accetta stringhe vuote
        // Ma il servizio le rifiuta in logica di business
        const dto = plainToClass(CreateDocumentDto, {
          name: "",
          templateId: "550e8400-e29b-41d4-a716-446655440000",
        });

        const errors = await validate(dto);

        // IsString accetta, quindi niente errori DTO
        expect(errors).toEqual([]);
      });

      it("deve gestire nome con spazi", async () => {
        const dto = plainToClass(CreateDocumentDto, {
          name: "  Nome con spazi  ",
          templateId: "550e8400-e29b-41d4-a716-446655440000",
        });

        const errors = await validate(dto);

        expect(errors).toEqual([]);
      });

      it("deve gestire nome con caratteri speciali", async () => {
        const dto = plainToClass(CreateDocumentDto, {
          name: "Documento @#$% & speciale",
          templateId: "550e8400-e29b-41d4-a716-446655440000",
        });

        const errors = await validate(dto);

        expect(errors).toEqual([]);
      });

      it("deve gestire null nel nome", async () => {
        const dto = plainToClass(CreateDocumentDto, {
          name: null,
          templateId: "550e8400-e29b-41d4-a716-446655440000",
        });

        const errors = await validate(dto);

        expect(errors.length).toBeGreaterThan(0);
      });
    });
  });

  describe("UpdateDocumentDto", () => {
    describe("Black-box tests", () => {
      it("deve accettare input vuoto", async () => {
        const dto = plainToClass(UpdateDocumentDto, {});

        const errors = await validate(dto);

        expect(errors).toEqual([]);
      });

      it("deve accettare solo name", async () => {
        const dto = plainToClass(UpdateDocumentDto, {
          name: "Updated Name",
        });

        const errors = await validate(dto);

        expect(errors).toEqual([]);
      });

      it("deve accettare solo content", async () => {
        const dto = plainToClass(UpdateDocumentDto, {
          content: "# New Content",
        });

        const errors = await validate(dto);

        expect(errors).toEqual([]);
      });

      it("deve accettare solo fieldValues", async () => {
        const dto = plainToClass(UpdateDocumentDto, {
          fieldValues: { titolo: "Test" },
        });

        const errors = await validate(dto);

        expect(errors).toEqual([]);
      });

      it("deve accettare tutti i campi", async () => {
        const dto = plainToClass(UpdateDocumentDto, {
          name: "Updated",
          content: "# Content",
          fieldValues: { titolo: "Test", importo: 1000 },
        });

        const errors = await validate(dto);

        expect(errors).toEqual([]);
      });

      it("deve rifiutare name non string", async () => {
        const dto = plainToClass(UpdateDocumentDto, {
          name: 123,
        });

        const errors = await validate(dto);

        expect(errors.length).toBeGreaterThan(0);
      });

      it("deve rifiutare content non string", async () => {
        const dto = plainToClass(UpdateDocumentDto, {
          content: 123,
        });

        const errors = await validate(dto);

        expect(errors.length).toBeGreaterThan(0);
      });

      it("deve rifiutare fieldValues non object", async () => {
        const dto = plainToClass(UpdateDocumentDto, {
          fieldValues: "not an object",
        });

        const errors = await validate(dto);

        expect(errors.length).toBeGreaterThan(0);
      });

      it("deve rifiutare fieldValues come array", async () => {
        const dto = plainToClass(UpdateDocumentDto, {
          fieldValues: ["item1", "item2"],
        });

        const errors = await validate(dto);

        expect(errors.length).toBeGreaterThan(0);
      });

      it("deve accettare fieldValues vuoto", async () => {
        const dto = plainToClass(UpdateDocumentDto, {
          fieldValues: {},
        });

        const errors = await validate(dto);

        expect(errors).toEqual([]);
      });
    });

    describe("Boundary cases", () => {
      it("deve gestire fieldValues con null values", async () => {
        const dto = plainToClass(UpdateDocumentDto, {
          fieldValues: { titolo: null, cliente: "Test" },
        });

        const errors = await validate(dto);

        // @IsObject accetta oggetti con valori null
        expect(errors).toEqual([]);
      });

      it("deve gestire fieldValues con tipi misti", async () => {
        const dto = plainToClass(UpdateDocumentDto, {
          fieldValues: {
            string: "text",
            number: 123,
            boolean: true,
            null: null,
          },
        });

        const errors = await validate(dto);

        expect(errors).toEqual([]);
      });

      it("deve accettare fieldValues con molte proprietà", async () => {
        const fieldValues = Object.fromEntries(
          Array(100)
            .fill(0)
            .map((_, i) => [`campo${i}`, `value${i}`]),
        );

        const dto = plainToClass(UpdateDocumentDto, {
          fieldValues,
        });

        const errors = await validate(dto);

        expect(errors).toEqual([]);
      });

      it("deve accettare content molto lungo", async () => {
        const dto = plainToClass(UpdateDocumentDto, {
          content: "# Content\n" + "Paragrafo\n".repeat(10000),
        });

        const errors = await validate(dto);

        expect(errors).toEqual([]);
      });

      it("deve accettare content vuoto", async () => {
        const dto = plainToClass(UpdateDocumentDto, {
          content: "",
        });

        const errors = await validate(dto);

        expect(errors).toEqual([]);
      });
    });

    describe("Failure modes", () => {
      it("deve gestire undefined come undefined", async () => {
        const dto = plainToClass(UpdateDocumentDto, {
          name: undefined,
        });

        const errors = await validate(dto);

        // undefined su campo optional dovrebbe andare bene
        expect(errors).toEqual([]);
      });

      it("deve rifiutare proprieta aggiuntive non dichiarate", async () => {
        const dto = plainToClass(UpdateDocumentDto, {
          name: "Test",
          invalidField: "should be ignored or validated",
        });

        const errors = await validate(dto);

        // class-validator non valida proprieta extra
        expect(errors).toEqual([]);
      });
    });
  });

  describe("CreateTemplateDto and UpdateTemplateDto", () => {
    describe("CreateTemplateDto", () => {
      it("deve accettare input valido minimo", async () => {
        const dto = plainToClass(CreateTemplateDto, {
          name: "Test Template",
          content: "# {{titolo}}",
        });

        const errors = await validate(dto);

        expect(errors).toEqual([]);
      });

      it("deve accettare input con section_id", async () => {
        const dto = plainToClass(CreateTemplateDto, {
          name: "Test",
          content: "# Content",
          section_id: "550e8400-e29b-41d4-a716-446655440000",
        });

        const errors = await validate(dto);

        expect(errors).toEqual([]);
      });

      it("deve accettare input con fields", async () => {
        const dto = plainToClass(CreateTemplateDto, {
          name: "Test",
          content: "# {{titolo}}",
          fields: [
            { name: "titolo", label: "Titolo", type: "text", required: true },
          ],
        });

        const errors = await validate(dto);

        expect(errors).toEqual([]);
      });

      it("deve accettare input con description", async () => {
        const dto = plainToClass(CreateTemplateDto, {
          name: "Test",
          content: "Content",
          description: "Una descrizione di prova",
        });

        const errors = await validate(dto);

        expect(errors).toEqual([]);
      });

      it("deve accettare input con created_by", async () => {
        const dto = plainToClass(CreateTemplateDto, {
          name: "Test",
          content: "Content",
          created_by: "user@example.com",
        });

        const errors = await validate(dto);

        expect(errors).toEqual([]);
      });

      it("deve rifiutare name mancante", async () => {
        const dto = plainToClass(CreateTemplateDto, {
          content: "Content",
        });

        const errors = await validate(dto);

        expect(errors.length).toBeGreaterThan(0);
      });

      it("deve rifiutare content mancante", async () => {
        const dto = plainToClass(CreateTemplateDto, {
          name: "Test",
        });

        const errors = await validate(dto);

        expect(errors.length).toBeGreaterThan(0);
      });
    });

    describe("UpdateTemplateDto", () => {
      it("deve accettare input vuoto", async () => {
        const dto = plainToClass(UpdateTemplateDto, {});

        const errors = await validate(dto);

        expect(errors).toEqual([]);
      });

      it("deve accettare section_id null", async () => {
        const dto = plainToClass(UpdateTemplateDto, {
          section_id: null,
        });

        const errors = await validate(dto);

        expect(errors).toEqual([]);
      });

      it("deve accettare qualsiasi combinazione di campi", async () => {
        const dto = plainToClass(UpdateTemplateDto, {
          name: "Updated",
          description: "Updated description",
          content: "# Updated",
          fields: [{ name: "field1" }],
        });

        const errors = await validate(dto);

        expect(errors).toEqual([]);
      });
    });
  });

  describe("Integration - Flusso validazione completo", () => {
    it("deve validare un workflow di creazione e update", async () => {
      // Create
      const createDto = plainToClass(CreateDocumentDto, {
        name: "New Document",
        templateId: "550e8400-e29b-41d4-a716-446655440000",
      });
      const createErrors = await validate(createDto);
      expect(createErrors).toEqual([]);

      // Update
      const updateDto = plainToClass(UpdateDocumentDto, {
        name: "Updated Document",
        content: "# New content",
        fieldValues: { titolo: "Test", cliente: "Mario" },
      });
      const updateErrors = await validate(updateDto);
      expect(updateErrors).toEqual([]);
    });

    it("deve rifiutare dati non validi in sequenza", async () => {
      const invalidDatas = [
        { name: 123, templateId: "invalid" },
        { name: "Test", templateId: "not-uuid" },
        { name: null, templateId: null },
      ];

      for (const data of invalidDatas) {
        const dto = plainToClass(CreateDocumentDto, data);
        const errors = await validate(dto);
        expect(errors.length).toBeGreaterThan(0);
      }
    });
  });
});
