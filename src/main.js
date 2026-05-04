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

  app.setGlobalPrefix('api', {
    exclude: ['health'],
  });

  // Swagger UI — solo le API pubbliche
  // Nota: audit non ha una sezione dedicata, le sue route sono dentro templates e documents
  const swaggerConfig = new DocumentBuilder()
    .setTitle('MAC Documents API')
    .setDescription('API per la generazione documentale basata su template Markdown.')
    .setVersion('1.0.0')
    .addTag('health',    'Stato applicazione')
    .addTag('templates', 'Gestione template documentali')
    .addTag('documents', 'Gestione documenti generati')
    .build();

  const swaggerDoc = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api-docs', app, swaggerDoc, {
    swaggerOptions: {
      persistAuthorization: true,
      defaultModelsExpandDepth: 1,
    },
  });

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

  // Esegue i test di regressione automaticamente all'avvio (solo in development)
  if (process.env.NODE_ENV === 'development') {
    console.log('🧪 NODE_ENV=development — avvio suite di regression test...\n');
    try {
      const { runApiRegressionSuite } = require('./modules/dev/api-regression.service');
      const result = await runApiRegressionSuite({
        baseUrl: `http://localhost:${port}`,
        reset:   true,
      });
      const passed = result.tests?.filter(t => t.ok).length ?? 0;
      const total  = result.tests?.length ?? 0;
      console.log(`✅ Regression test completati: ${passed}/${total} passati\n`);
    } catch (err) {
      console.error('❌ Regression test FALLITI:', err.message);
      if (err.failedTest) console.error('   Test fallito:', err.failedTest);
    }
  }
}

bootstrap().catch((err) => {
  console.error('❌ Errore avvio applicazione:', err.message);
  process.exit(1);
});
