import { plainToClass } from "class-transformer";
import { validate } from "class-validator";
import { CreateTemplateDto } from "../src/dto/create-template.dto";
import { GeneratePdfDto } from "../src/dto/generate-pdf.dto";
import { UpdateTemplateDto } from "../src/dto/update-template.dto";

async function validateDto<T extends object>(
  cls: new (...args: unknown[]) => T,
  data: Record<string, unknown>,
) {
  return validate(plainToClass(cls, data));
}

describe("DTO Validation", () => {
  describe("CreateTemplateDto", () => {
    it("deve accettare input valido minimo", async () => {
      expect(
        await validateDto(CreateTemplateDto, {
          name: "Test",
          content: "# {{titolo}}",
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
          description: "Desc",
        }),
      ).toEqual([]);
    });

    it("deve rifiutare name mancante", async () => {
      const errors = await validateDto(CreateTemplateDto, {
        content: "Content",
      });
      expect(errors.length).toBeGreaterThan(0);
    });

    it("deve rifiutare content mancante", async () => {
      const errors = await validateDto(CreateTemplateDto, { name: "Test" });
      expect(errors.length).toBeGreaterThan(0);
    });

    it("deve rifiutare name molto lungo (> 255 caratteri)", async () => {
      const errors = await validateDto(CreateTemplateDto, {
        name: "A".repeat(10000),
        content: "# test",
      });
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe("UpdateTemplateDto", () => {
    it("deve accettare input vuoto", async () => {
      expect(await validateDto(UpdateTemplateDto, {})).toEqual([]);
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

    it("deve rifiutare name non string", async () => {
      const errors = await validateDto(UpdateTemplateDto, { name: 123 });
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe("GeneratePdfDto", () => {
    it("deve accettare fieldValues vuoto", async () => {
      expect(await validateDto(GeneratePdfDto, { fieldValues: {} })).toEqual(
        [],
      );
    });

    it("deve accettare fieldValues con valori misti", async () => {
      expect(
        await validateDto(GeneratePdfDto, {
          fieldValues: {
            titolo: "Test",
            importo: 1000,
            attivo: true,
            note: null,
          },
        }),
      ).toEqual([]);
    });

    it("preserva le chiavi arbitrarie di fieldValues con whitelist attiva", async () => {
      const dto = plainToClass(GeneratePdfDto, {
        fieldValues: {
          titolo: "Valore compilato",
          righe: [{ descrizione: "Servizio", quantita: 2 }],
        },
        extra: "rimosso",
      });

      expect(await validate(dto, { whitelist: true })).toEqual([]);
      expect(dto.fieldValues).toEqual({
        titolo: "Valore compilato",
        righe: [{ descrizione: "Servizio", quantita: 2 }],
      });
      expect(dto).not.toHaveProperty("extra");
    });

    it("deve rifiutare fieldValues non object", async () => {
      const errors = await validateDto(GeneratePdfDto, {
        fieldValues: "stringa",
      });
      expect(errors.length).toBeGreaterThan(0);
    });

    it("deve rifiutare fieldValues come array", async () => {
      const errors = await validateDto(GeneratePdfDto, {
        fieldValues: ["a", "b"],
      });
      expect(errors.length).toBeGreaterThan(0);
    });

    it("deve accettare input vuoto (fieldValues opzionale)", async () => {
      expect(await validateDto(GeneratePdfDto, {})).toEqual([]);
    });
  });

  describe("Integration - flusso template + PDF", () => {
    it("deve validare creazione template e avvio PDF", async () => {
      expect(
        await validateDto(CreateTemplateDto, {
          name: "Offerta",
          content: "# {{titolo}}",
        }),
      ).toEqual([]);
      expect(
        await validateDto(GeneratePdfDto, {
          fieldValues: { titolo: "Test", cliente: "Mario" },
        }),
      ).toEqual([]);
    });

    it("deve rifiutare dati non validi", async () => {
      const invalids = [
        { content: "solo content senza name" },
        { name: 123, content: "test" },
      ];
      for (const data of invalids) {
        const errors = await validateDto(
          CreateTemplateDto,
          data as Record<string, unknown>,
        );
        expect(errors.length).toBeGreaterThan(0);
      }
    });
  });
});
