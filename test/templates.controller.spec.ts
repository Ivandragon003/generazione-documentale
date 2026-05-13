import type { Response } from "express";
import { TemplatesController } from "../src/controller/templates.controller";
import type { PdfJobsService } from "../src/service/pdf-jobs.service";
import type { TemplatesService } from "../src/service/templates.service";

describe("TemplatesController", () => {
  const templatesService = {} as TemplatesService;
  const pdfJobsService = {
    streamLatest: jest.fn(),
  } as unknown as PdfJobsService;

  const controller = new TemplatesController(templatesService, pdfJobsService);

  it("ritorna 400 con fieldValues query malformato su /pdf/latest", async () => {
    const response = {} as Response;

    await expect(
      controller.downloadLatestPdf("github:cat/sec/name", "{invalid", response),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("accetta fieldValues query valido e invoca streamLatest", async () => {
    const response = {} as Response;

    await controller.downloadLatestPdf(
      "github:cat/sec/name",
      JSON.stringify({ titolo: "ok" }),
      response,
    );

    expect((pdfJobsService.streamLatest as jest.Mock).mock.calls[0]).toEqual([
      "github:cat/sec/name",
      response,
      { titolo: "ok" },
    ]);
  });
});
