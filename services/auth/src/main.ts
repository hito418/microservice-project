import { AUTH_PROTO_PATH, AUTH_V1_PACKAGE_NAME } from '@contracts/auth';
import { type LogLevel, Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {
    type GrpcOptions,
    type MicroserviceOptions,
    Transport,
} from '@nestjs/microservices';
import { AppModule } from './app.module';

const HOST = process.env.AUTH_GRPC_HOST ?? '127.0.0.1';
const PORT = Number(process.env.AUTH_GRPC_PORT ?? 50051);

const grpcOptions: GrpcOptions['options'] = {
    package: AUTH_V1_PACKAGE_NAME,
    protoPath: AUTH_PROTO_PATH,
    url: `${HOST}:${PORT}`,
};

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
            transport: Transport.GRPC,
            options: grpcOptions,
            logger: resolveLogLevels(),
        },
    );
    await app.listen();
    new Logger('Bootstrap').log(`auth gRPC microservice listening on ${HOST}:${PORT}`);
}

bootstrap();
