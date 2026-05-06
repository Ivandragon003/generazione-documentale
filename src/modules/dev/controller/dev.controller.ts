import { mkdir, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import {
  Body,
  Controller,
  HttpCode,
  HttpException,
  HttpStatus,
  Post,
  Req,
} from "@nestjs/common";
import { ApiHeader, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { makeError } from "../../../common/utils/errors";
import type { ExecuteTestRunDto } from "../dto/execute-test-run.dto";
import type { SeedLargePdfDto } from "../dto/seed-large-pdf.dto";
import type { DevRepository } from "../repository/dev.repository";
import {
  ApiRegressionFailure,
  runApiRegressionSuite,
  runLargePdfSeed,
} from "../service/api-regression.service";

const STORAGE_PATH = process.env.STORAGE_PATH ?? "./storage/pdf";
const TEMPLATE_STORAGE_PATH =
  process.env.TEMPLATE_STORAGE_PATH ?? "./storage/templates";
const UPLOAD_PATH = process.env.UPLOAD_PATH ?? "./storage/uploads";

const FIXTURE_TEMPLATE_ID = "11111111-1111-4111-8111-111111111111";
const FIXTURE_DELETE_TEMPLATE_ID = "11111111-1111-4111-8111-111111111112";
const FIXTURE_DOCUMENT_ID = "22222222-2222-4222-8222-222222222222";
const FIXTURE_PDF_JOB_ID = "33333333-3333-4333-8333-333333333333";
const FIXTURE_PDF_FILENAME = "fixture-completed.pdf";

const resetDirectory = async (directoryPath: string): Promise<void> => {
  await rm(directoryPath, { recursive: true, force: true });
  await mkdir(directoryPath, { recursive: true });
};

const writeFixtureTemplate = async (
  templateId: string,
  content: string,
): Promise<string> => {
  const templateDirectory = resolve(TEMPLATE_STORAGE_PATH, templateId);
  await mkdir(templateDirectory, { recursive: true });
  await writeFile(join(templateDirectory, "v1.md"), content, "utf8");
  return `${templateId}/v1.md`;
};

@ApiTags("dev")
@Controller("dev")
export class DevController {
  constructor(private readonly devRepository: DevRepository) {}

  private assertNotProduction(): void {
    if (process.env.NODE_ENV === "production") {
      throw makeError("Operazione non disponibile in produzione", 403);
    }
  }

  private async seedDevFixtures(): Promise<void> {
    const content =
      "# {{titolo}}\n\nCliente: {{cliente}}\nImporto: {{importo}}\nData: {{data}}\n";
    const fields = [
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
      {
        name: "importo",
        label: "Importo",
        type: "text",
        required: true,
        defaultValue: "",
      },
      {
        name: "data",
        label: "Data",
        type: "date",
        required: true,
        defaultValue: "",
      },
    ];
    const fieldValues = {
      titolo: "Documento fixture",
      cliente: "Cliente fixture",
      importo: "1000",
      data: "2026-04-29",
    };

    const contentPath = await writeFixtureTemplate(
      FIXTURE_TEMPLATE_ID,
      content,
    );
    const deleteContentPath = await writeFixtureTemplate(
      FIXTURE_DELETE_TEMPLATE_ID,
      content,
    );
    const pdfPath = resolve(STORAGE_PATH, FIXTURE_PDF_FILENAME);

    await writeFile(
      pdfPath,
      "%PDF-1.4\n% fixture pdf\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n",
      "utf8",
    );

    await this.devRepository.insertFixtureTemplate({
      id: FIXTURE_TEMPLATE_ID,
      name: "Template Fixture",
      description: "Template stabile per collection API",
      contentPath,
      fields,
    });
    await this.devRepository.insertFixtureTemplateVersion(
      FIXTURE_TEMPLATE_ID,
      contentPath,
      fields,
    );

    await this.devRepository.insertFixtureTemplate({
      id: FIXTURE_DELETE_TEMPLATE_ID,
      name: "Template Fixture Delete",
      description: "Template eliminabile per collection API",
      contentPath: deleteContentPath,
      fields,
    });
    await this.devRepository.insertFixtureTemplateVersion(
      FIXTURE_DELETE_TEMPLATE_ID,
      deleteContentPath,
      fields,
    );

    await this.devRepository.insertFixtureDocument({
      id: FIXTURE_DOCUMENT_ID,
      name: "Documento Fixture",
      templateId: FIXTURE_TEMPLATE_ID,
      content,
      fieldValues,
    });
    await this.devRepository.insertFixtureDocumentVersion(
      FIXTURE_DOCUMENT_ID,
      content,
      fieldValues,
    );
    await this.devRepository.insertFixturePdfJob(
      FIXTURE_PDF_JOB_ID,
      FIXTURE_DOCUMENT_ID,
      FIXTURE_PDF_FILENAME,
    );
  }

  @Post("test-runs/execute")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Esegue la suite di regression test API" })
  @ApiResponse({ status: 200, description: "Tutti i test superati" })
  @ApiResponse({ status: 500, description: "Almeno un test fallito" })
  async executeTestRun(
    @Body() body: ExecuteTestRunDto,
    @Req() request: Request,
  ) {
    this.assertNotProduction();

    const suite = body.suite ?? "api-regression";
    if (suite !== "api-regression") {
      throw makeError("Suite non supportata", 400);
    }

    try {
      return await runApiRegressionSuite({
        baseUrl: body.baseUrl,
        request,
        reset: body.reset !== false,
      });
    } catch (error) {
      if (error instanceof ApiRegressionFailure) {
        throw new HttpException(
          {
            ok: false,
            suite,
            error: error.message,
            failedTest: error.failedTest,
            tests: error.tests,
          },
          500,
        );
      }

      throw error;
    }
  }

  @Post("reset")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Reset dati e storage (solo dev/test)" })
  @ApiHeader({
    name: "x-reset-confirm",
    required: true,
    description: "Deve essere true",
  })
  async reset(@Req() request: Request) {
    this.assertNotProduction();

    if (request.headers["x-reset-confirm"] !== "true") {
      throw makeError("Header x-reset-confirm: true obbligatorio", 400);
    }

    await this.devRepository.truncateAll();
    await Promise.all([
      resetDirectory(resolve(TEMPLATE_STORAGE_PATH)),
      resetDirectory(resolve(STORAGE_PATH)),
      resetDirectory(resolve(UPLOAD_PATH)),
    ]);
    await this.seedDevFixtures();

    return {
      reset: true,
      fixtures: {
        templateId: FIXTURE_TEMPLATE_ID,
        deleteTemplateId: FIXTURE_DELETE_TEMPLATE_ID,
        documentId: FIXTURE_DOCUMENT_ID,
        pdfJobId: FIXTURE_PDF_JOB_ID,
      },
    };
  }

  @Post("seed-large-pdf")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "Seed template grande con campi parziali + generazione PDF",
  })
  async seedLargePdf(@Body() body: SeedLargePdfDto, @Req() request: Request) {
    this.assertNotProduction();

    try {
      return await runLargePdfSeed({
        baseUrl: body.baseUrl,
        request,
      });
    } catch (error) {
      throw makeError(
        error instanceof Error ? error.message : "Errore seed large PDF",
        500,
      );
    }
  }
}
