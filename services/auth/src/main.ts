import { NestFactory } from '@nestjs/core';
import {
    FastifyAdapter,
    NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { AppModule } from './app.module';

const HOST = process.env.AUTH_HOST ?? '127.0.0.1';
const PORT = Number(process.env.AUTH_PORT ?? 3002);

async function bootstrap() {
    const app = await NestFactory.create<NestFastifyApplication>(
        AppModule,
        new FastifyAdapter(),
    );
    await app.listen(PORT, HOST);
    console.log(`auth HTTP (fastify) listening on http://${HOST}:${PORT}`);
}

bootstrap();
