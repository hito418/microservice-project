import { type LogLevel, Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { MicroserviceOptions, Transport } from "@nestjs/microservices";
import { AppModule } from "./app.module";

const HOST = process.env.FIBONACCI_HOST ?? "127.0.0.1";
const PORT = Number(process.env.FIBONACCI_PORT ?? 3001);

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
    const app = await NestFactory.createMicroservice<MicroserviceOptions>(
        AppModule,
        {
            transport: Transport.TCP,
            options: { host: HOST, port: PORT },
            logger: resolveLogLevels(),
        },
    );
    await app.listen();
    new Logger('Bootstrap').log(`fibonacci microservice listening on tcp://${HOST}:${PORT}`);
}

bootstrap();
