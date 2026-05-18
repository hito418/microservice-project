import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { CleanupScheduler } from './cleanup.scheduler';

async function bootstrap() {
    const app = await NestFactory.createApplicationContext(AppModule);
    app.enableShutdownHooks();
    const logger = new Logger('runner-room-cleanup');

    const scheduler = app.get(CleanupScheduler);
    await scheduler.schedule();

    logger.log('room-cleanup-runner started');
}

bootstrap();
