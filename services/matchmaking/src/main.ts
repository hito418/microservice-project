import 'reflect-metadata';
import { MATCHMAKING_PROTO_PATH, MATCHMAKING_V1_PACKAGE_NAME } from '@contracts/matchmaking';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { type GrpcOptions, type MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app.module';
import { ConfigService } from './config/config.service';

async function bootstrap() {
    const config = new ConfigService();

    const grpcOptions: GrpcOptions['options'] = {
        package: MATCHMAKING_V1_PACKAGE_NAME,
        protoPath: MATCHMAKING_PROTO_PATH,
        url: `${config.grpcHost}:${config.grpcPort}`,
    };

    const app = await NestFactory.createMicroservice<MicroserviceOptions>(AppModule, {
        transport: Transport.GRPC,
        options: grpcOptions,
        logger: config.logLevels,
    });
    await app.listen();
    new Logger('Bootstrap').log(
        `matchmaking gRPC microservice listening on ${config.grpcHost}:${config.grpcPort}`,
    );
}

bootstrap();
