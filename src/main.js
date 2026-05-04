'use strict';

require('dotenv').config();

const fs = require('fs');
const { NestFactory }   = require('@nestjs/core');
const { SwaggerModule, DocumentBuilder } = require('@nestjs/swagger');
const { AppModule }     = require('./app.module');

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'warn', 'error'],
  });

  // Prefisso globale /api — /health escluso (standard per load balancer / k8s)
  app.setGlobalPrefix('api', {
    exclude: ['health'],
  });

  // Swagger UI generato dinamicamente dai decorator NestJS
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
    .addTag('pdf',       'Utilità generazione PDF')
    .addTag('dev',       'Strumenti di sviluppo e test (solo NODE_ENV=development)')
    .build();

  const swaggerDoc = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api-docs', app, swaggerDoc, {
    swaggerOptions: {
      persistAuthorization: true,
      defaultModelsExpandDepth: 1,
    },
  });

  // Esporta la spec OpenAPI su file (solo in sviluppo)
  if (process.env.NODE_ENV !== 'production') {
    fs.writeFileSync('./openapi.json', JSON.stringify(swaggerDoc, null, 2), 'utf8');
    console.log('   OpenAPI JSON: openapi.json salvato nella root del progetto');
  }

  const port = parseInt(process.env.PORT, 10) || 3000;
  await app.listen(port);

  console.log(`\n✅ MAC Documents API avviata su http://localhost:${port}`);
  console.log(`   Swagger UI  : http://localhost:${port}/api-docs`);
  console.log(`   Health check: http://localhost:${port}/health`);
  console.log(`   API routes  : http://localhost:${port}/api/...\n`);
}

bootstrap().catch((err) => {
  console.error('❌ Errore avvio applicazione:', err.message);
  process.exit(1);
});
