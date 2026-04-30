require('dotenv').config();
require('reflect-metadata');

const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('./app.module');
const { SwaggerModule, DocumentBuilder } = require('@nestjs/swagger');

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');

  // ── Swagger ──────────────────────────────────────────────────────────────
  const config = new DocumentBuilder()
    .setTitle('MAC Documents API')
    .setDescription(
      'API REST per la gestione di template documentali, documenti e generazione PDF asincrona tramite Pandoc.',
    )
    .setVersion('1.0.0')
    .addTag('templates', 'Gestione template Markdown')
    .addTag('documents', 'Gestione documenti generati dai template')
    .addTag('pdf', 'Validazione disponibilità template per PDF')
    .addTag('audit', 'Registro immutabile delle operazioni')
    .addTag('dev', 'Endpoint interni per test e reset (non disponibili in produzione)')
    .addApiKey({ type: 'apiKey', name: 'x-user', in: 'header' }, 'x-user')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
  });
  // ─────────────────────────────────────────────────────────────────────────

  const PORT = process.env.PORT || 3000;
  await app.listen(PORT);

  console.log(`MAC Documents API running on port ${PORT}`);
  console.log(`Health check : http://localhost:${PORT}/api/health`);
  console.log(`Swagger docs : http://localhost:${PORT}/docs`);
}

bootstrap();