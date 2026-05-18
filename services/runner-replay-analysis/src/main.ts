import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
    const app = await NestFactory.createApplicationContext(AppModule);
    app.enableShutdownHooks();
    const logger = new Logger('runner-replay-analysis');
    logger.log('debate-replay-analysis-runner started');
}

bootstrap();
