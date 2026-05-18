import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
    const app = await NestFactory.createApplicationContext(AppModule);
    app.enableShutdownHooks();
    const logger = new Logger('runner-finalization');
    logger.log('debate-finalization-runner started');
}

bootstrap();
