import { plainToClass } from "class-transformer";
import { validate } from "class-validator";
import { CreateTemplateDto } from "../src/dto/create-template.dto";
import { GeneratePdfDto } from "../src/dto/generate-pdf.dto";
import { GenerateTemplateDraftDto } from "../src/dto/generate-template-draft.dto";
import { RepairTemplateDraftDto } from "../src/dto/repair-template-draft.dto";
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

    it("rimuove campi non esposti dal DTO con whitelist attiva", async () => {
      const dto = plainToClass(CreateTemplateDto, {
        name: "Test",
        content: "Content",
        description: "Desc",
      });

      expect(await validate(dto, { whitelist: true })).toEqual([]);
      expect(dto).not.toHaveProperty("description");
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

    it("deve accettare qualsiasi combinazione di campi modificabili", async () => {
      expect(
        await validateDto(UpdateTemplateDto, {
          name: "Updated",
          content: "# Updated",
          fields: [{ name: "field1" }],
        }),
      ).toEqual([]);
    });

    it("deve rimuovere path perché l'update non sposta file GitHub", async () => {
      const dto = plainToClass(UpdateTemplateDto, {
        name: "Updated",
        path: "new/folder/template",
      });

      expect(await validate(dto, { whitelist: true })).toEqual([]);
      expect(dto).not.toHaveProperty("path");
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

    it("deve accettare la lingua del browser opzionale", async () => {
      expect(
        await validateDto(GeneratePdfDto, {
          fieldValues: {},
          language: "ja-JP",
        }),
      ).toEqual([]);
    });
  });

  describe("GenerateTemplateDraftDto", () => {
    it("deve accettare input valido minimo", async () => {
      expect(
        await validateDto(GenerateTemplateDraftDto, {
          description: "Verbale riunione settimanale con partecipanti e azioni",
        }),
      ).toEqual([]);
    });

    it("deve accettare lingua e semantic audit opzionali", async () => {
      expect(
        await validateDto(GenerateTemplateDraftDto, {
          description: "Report attività mensile",
          language: "it",
          runSemanticAudit: true,
          generationMode: "guided",
          autoRepair: true,
          defaultLength: 120,
        }),
      ).toEqual([]);
    });

    it("deve accettare generationMode free", async () => {
      expect(
        await validateDto(GenerateTemplateDraftDto, {
          description: "Report breve",
          generationMode: "free",
        }),
      ).toEqual([]);
    });

    it("deve rifiutare generationMode non valido", async () => {
      const errors = await validateDto(GenerateTemplateDraftDto, {
        description: "Report breve",
        generationMode: "invalid",
      });
      expect(errors.length).toBeGreaterThan(0);
    });

    it("deve rifiutare defaultLength non positivo", async () => {
      const errors = await validateDto(GenerateTemplateDraftDto, {
        description: "Report mensile",
        defaultLength: 0,
      });
      expect(errors.length).toBeGreaterThan(0);
    });

    it("deve rifiutare description vuota", async () => {
      const errors = await validateDto(GenerateTemplateDraftDto, {
        description: "",
      });
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe("RepairTemplateDraftDto", () => {
    it("accepts valid payload with defaultLength", async () => {
      expect(
        await validateDto(RepairTemplateDraftDto, {
          content: "{{string:unità_responsabile}}",
          defaultLength: 100,
          generationMode: "guided",
        }),
      ).toEqual([]);
    });

    it("rejects empty content", async () => {
      const errors = await validateDto(RepairTemplateDraftDto, {
        content: "",
      });
      expect(errors.length).toBeGreaterThan(0);
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

    it("deve rifiutare dati Invalid placeholders", async () => {
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
