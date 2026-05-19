import { type LogLevel, Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module';

const HOST = process.env.GATEWAY_HOST ?? '127.0.0.1';
const PORT = Number(process.env.GATEWAY_PORT ?? 3000);

const LEVEL_ORDER: readonly LogLevel[] = [
    'verbose', 'debug', 'log', 'warn', 'error', 'fatal',
];

function resolveLogLevels(): LogLevel[] {
    const requested = (process.env.LOG_LEVEL ?? 'log').toLowerCase();
    const idx = LEVEL_ORDER.indexOf(requested as LogLevel);
    const start = idx === -1 ? LEVEL_ORDER.indexOf('log') : idx;
    return LEVEL_ORDER.slice(start);
}

async function bootstrap() {
    const app = await NestFactory.create<NestFastifyApplication>(
        AppModule,
        new FastifyAdapter(),
        { logger: resolveLogLevels() },
    );
    await app.listen(PORT, HOST);
    new Logger('Bootstrap').log(
        `gateway HTTP (fastify) listening on http://${HOST}:${PORT}`,
    );
}

bootstrap();
