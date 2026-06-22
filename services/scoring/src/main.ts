import { SCORING_PROTO_PATH, SCORING_V1_PACKAGE_NAME } from '@contracts/scoring';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {
    type GrpcOptions,
    type MicroserviceOptions,
    Transport,
} from '@nestjs/microservices';
import { AppModule } from './app.module';
import { ConfigService } from './config/config.service';

async function bootstrap() {
    const config = new ConfigService();

    const grpcOptions: GrpcOptions['options'] = {
        package: SCORING_V1_PACKAGE_NAME,
        protoPath: SCORING_PROTO_PATH,
        url: `${config.grpcHost}:${config.grpcPort}`,
    };

    const app = await NestFactory.createMicroservice<MicroserviceOptions>(
        AppModule,
        {
            transport: Transport.GRPC,
            options: grpcOptions,
            logger: config.logLevels,
        },
    );
    await app.listen();
    new Logger('Bootstrap').log(
        `scoring gRPC microservice listening on ${config.grpcHost}:${config.grpcPort}`,
    );
}

bootstrap();
