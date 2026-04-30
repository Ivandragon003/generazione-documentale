'use strict';

require('dotenv').config();

const { NestFactory }   = require('@nestjs/core');
const { SwaggerModule, DocumentBuilder } = require('@nestjs/swagger');
const { AppModule }     = require('./app.module');
const { getPool }       = require('./database/database');

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'warn', 'error'],
  });

  // ── Prefisso globale /api ──────────────────────────────────────────────────
  app.setGlobalPrefix('api');

  // ── Swagger / OpenAPI (generato dinamicamente dai decoratori) ─────────────
  const swaggerConfig = new DocumentBuilder()
    .setTitle('MAC Documents API')
    .setDescription(
      'API per la generazione documentale basata su template Markdown.\n\n' +
      '**Ambienti di sviluppo:** le route /api/dev/* sono disponibili solo con NODE_ENV=development.',
    )
    .setVersion('1.0.0')
    .addTag('health',    'Stato applicazione')
    .addTag('templates', 'Gestione template documentali')
    .addTag('documents', 'Gestione documenti generati')
    .addTag('audit',     'Registro audit immutabile')
    .build();

  const swaggerDoc = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api-docs', app, swaggerDoc, {
    swaggerOptions: {
      persistAuthorization: true,
      defaultModelsExpandDepth: -1,
    },
  });

  // ── Porta ─────────────────────────────────────────────────────────────────
  const port = parseInt(process.env.PORT, 10) || 3000;
  await app.listen(port);

  console.log(`\n✅ MAC Documents API avviata su http://localhost:${port}`);
  console.log(`   Swagger UI  : http://localhost:${port}/api-docs`);
  console.log(`   Health check: http://localhost:${port}/api/health\n`);
}

bootstrap().catch((err) => {
  console.error('❌ Errore avvio applicazione:', err.message);
  process.exit(1);
});
