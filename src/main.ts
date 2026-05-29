import "reflect-metadata";
import "dotenv/config";
import { writeFileSync } from "node:fs";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    logger: ["log", "warn", "error"],
    rawBody: true,
  });

  app.enableCors({
    origin: [
      "http://localhost:4173",
      "http://localhost:5173",
      "http://localhost:3001",
    ],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-user"],
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());

  app.setGlobalPrefix("api", {
    exclude: ["health"],
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle("MAC Documents API")
    .setDescription("API for document generation based on Markdown templates.")
    .setVersion("1.0.0")
    .addTag("health", "Application health")
    .addTag("templates", "GitHub templates, field rendering, and PDF")
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
  await app.listen(port);
}

bootstrap().catch((error: unknown) => {
  const message =
    error instanceof Error ? error.message : "Application startup error";
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
