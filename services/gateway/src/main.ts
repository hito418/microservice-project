import fastifyCookie from '@fastify/cookie';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import { ConfigService } from './config/config.service';

async function bootstrap() {
    const config = new ConfigService();

    const app = await NestFactory.create<NestFastifyApplication>(
        AppModule,
        new FastifyAdapter(),
        { logger: config.logLevels },
    );
    await app.register(fastifyCookie);
    await app.listen(config.httpPort, config.httpHost);
    new Logger('Bootstrap').log(
        `gateway HTTP (fastify) listening on http://${config.httpHost}:${config.httpPort}`,
    );
}

bootstrap();
