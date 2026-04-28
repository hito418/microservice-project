import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module';

const HOST = process.env.GATEWAY_HOST ?? '127.0.0.1';
const PORT = Number(process.env.GATEWAY_PORT ?? 3000);

async function bootstrap() {
    const app = await NestFactory.create<NestFastifyApplication>(
        AppModule,
        new FastifyAdapter(),
    );
    await app.listen(PORT, HOST);
    console.log(`gateway HTTP (fastify) listening on http://${HOST}:${PORT}`);
}

bootstrap();
