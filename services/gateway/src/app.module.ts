import { Module } from "@nestjs/common";
import { ClientsModule, Transport } from "@nestjs/microservices";
import { GatewayController } from "./gateway.controller";

const FIBONACCI_HOST = process.env.FIBONACCI_HOST ?? "127.0.0.1";
const FIBONACCI_PORT = Number(process.env.FIBONACCI_PORT ?? 4001);

@Module({
    imports: [
        ClientsModule.register([
            {
                name: "FIBONACCI_SERVICE",
                transport: Transport.TCP,
                options: { host: FIBONACCI_HOST, port: FIBONACCI_PORT },
            },
        ]),
    ],
    controllers: [GatewayController],
})
export class AppModule {}
