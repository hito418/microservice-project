import fastifyCookie from '@fastify/cookie';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { parsePort, resolveLogLevels } from '@repo/common';
import { AppModule } from './app.module';

const HOST = process.env.GATEWAY_HOST ?? '127.0.0.1';
const PORT = parsePort('GATEWAY_PORT', 3000);

async function bootstrap() {
    const app = await NestFactory.create<NestFastifyApplication>(
        AppModule,
        new FastifyAdapter(),
        { logger: resolveLogLevels() },
    );
    await app.register(fastifyCookie);
    await app.listen(PORT, HOST);
    new Logger('Bootstrap').log(
        `gateway HTTP (fastify) listening on http://${HOST}:${PORT}`,
    );
}

bootstrap();
