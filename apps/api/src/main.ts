import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { loadRootEnv } from './config/env';
import {
  shutdownLangfuseInstrumentation,
  startLangfuseInstrumentation,
} from './observability/langfuse.instrumentation';

loadRootEnv();
const langfuseSdk = startLangfuseInstrumentation();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('SalonAI API')
    .setDescription('SalonAI Agent API')
    .setVersion('0.0.0')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document, {
    jsonDocumentUrl: 'openapi.json',
  });

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();

process.once('SIGTERM', () => {
  void shutdownLangfuseInstrumentation().finally(() => process.exit(0));
});

process.once('SIGINT', () => {
  void shutdownLangfuseInstrumentation().finally(() => process.exit(0));
});

void langfuseSdk;
