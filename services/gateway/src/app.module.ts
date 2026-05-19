import {
    AUTH_PROTO_PATH,
    AUTH_V1_PACKAGE_NAME,
} from "@contracts/auth";
import { Module } from "@nestjs/common";
import { ClientsModule, Transport } from "@nestjs/microservices";
import { parsePort } from "@repo/common";
import { AuthController } from "./auth/auth.controller";
import { GatewayController } from "./gateway.controller";

const SCORING_HOST = process.env.SCORING_HOST ?? "127.0.0.1";
const SCORING_PORT = parsePort(process.env.SCORING_PORT, 4002);

const AUTH_GRPC_HOST = process.env.AUTH_GRPC_HOST ?? "127.0.0.1";
const AUTH_GRPC_PORT = parsePort(process.env.AUTH_GRPC_PORT, 50051);

@Module({
    imports: [
        ClientsModule.register([
            {
                name: "SCORING_SERVICE",
                transport: Transport.TCP,
                options: { host: SCORING_HOST, port: SCORING_PORT },
            },
            {
                name: "AUTH_CLIENT",
                transport: Transport.GRPC,
                options: {
                    package: AUTH_V1_PACKAGE_NAME,
                    protoPath: AUTH_PROTO_PATH,
                    url: `${AUTH_GRPC_HOST}:${AUTH_GRPC_PORT}`,
                },
            },
        ]),
    ],
    controllers: [GatewayController, AuthController],
})
export class AppModule {}
