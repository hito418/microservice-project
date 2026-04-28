import { NestFactory } from "@nestjs/core";
import { MicroserviceOptions, Transport } from "@nestjs/microservices";
import { AppModule } from "./app.module";

const HOST = process.env.FIBONACCI_HOST ?? "127.0.0.1";
const PORT = Number(process.env.FIBONACCI_PORT ?? 3001);

async function bootstrap() {
    const app = await NestFactory.createMicroservice<MicroserviceOptions>(
        AppModule,
        {
            transport: Transport.TCP,
            options: { host: HOST, port: PORT },
        },
    );
    await app.listen();
    console.log(`fibonacci microservice listening on tcp://${HOST}:${PORT}`);
}

bootstrap();
