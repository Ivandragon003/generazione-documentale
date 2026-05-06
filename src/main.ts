import "reflect-metadata";
import { writeFileSync } from "node:fs";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { config } from "dotenv";
import { AppModule } from "./app.module";
import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter";
import { runApiRegressionSuite } from "./modules/dev/service/api-regression.service";

config();

const shouldRunRegressionOnBoot =
  process.env.NODE_ENV !== "production" &&
  process.env.RUN_REGRESSION_ON_BOOT === "true";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    logger: ["log", "warn", "error"],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidUnknownValues: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());

  app.setGlobalPrefix("api", {
    exclude: ["health"],
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle("MAC Documents API")
    .setDescription(
      "API per la generazione documentale basata su template Markdown.",
    )
    .setVersion("1.0.0")
    .addTag("health", "Stato applicazione")
    .addTag("templates", "Gestione template documentali")
    .addTag("documents", "Gestione documenti generati")
    .addTag("pdf", "Utilita generazione PDF")
    .addTag("dev", "Utility ambiente locale")
    .build();

  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("api-docs", app, swaggerDocument, {
    swaggerOptions: {
      persistAuthorization: true,
      defaultModelsExpandDepth: 1,
    },
  });

  if (process.env.NODE_ENV !== "production") {
    writeFileSync(
      "./openapi.json",
      JSON.stringify(swaggerDocument, null, 2),
      "utf8",
    );
  }

  const port = Number.parseInt(process.env.PORT ?? "3000", 10);
  await app.listen(Number.isInteger(port) ? port : 3000);

  if (shouldRunRegressionOnBoot) {
    await runApiRegressionSuite({
      baseUrl: `http://localhost:${port}`,
      reset: true,
    });
  }
}

bootstrap().catch((error: unknown) => {
  const message =
    error instanceof Error ? error.message : "Errore avvio applicazione";
  // eslint-disable-next-line no-console
  console.error(message);
  process.exit(1);
});
