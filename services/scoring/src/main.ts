import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app.module';
import { ConfigService } from './config/config.service';

async function bootstrap() {
    const config = new ConfigService();

    const app = await NestFactory.createMicroservice<MicroserviceOptions>(
        AppModule,
        {
            transport: Transport.TCP,
            options: { host: config.serverHost, port: config.serverPort },
            logger: config.logLevels,
        },
    );
    await app.listen();
    new Logger('Bootstrap').log(
        `scoring microservice listening on tcp://${config.serverHost}:${config.serverPort}`,
    );
}

bootstrap();
