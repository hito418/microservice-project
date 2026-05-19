import { Module } from "@nestjs/common";
import { ClientsModule, Transport } from "@nestjs/microservices";
import { GatewayController } from "./gateway.controller";

const FIBONACCI_HOST = process.env.FIBONACCI_HOST ?? "127.0.0.1";
const FIBONACCI_PORT = Number(process.env.FIBONACCI_PORT ?? 4001);
const SCORING_HOST = process.env.SCORING_HOST ?? "127.0.0.1";
const SCORING_PORT = Number(process.env.SCORING_PORT ?? 4002);

@Module({
    imports: [
        ClientsModule.register([
            {
                name: "FIBONACCI_SERVICE",
                transport: Transport.TCP,
                options: { host: FIBONACCI_HOST, port: FIBONACCI_PORT },
            },
            {
                name: "SCORING_SERVICE",
                transport: Transport.TCP,
                options: { host: SCORING_HOST, port: SCORING_PORT },
            },
        ]),
    ],
    controllers: [GatewayController],
})
export class AppModule {}
