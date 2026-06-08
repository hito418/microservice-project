import {
    AUTH_PROTO_PATH,
    AUTH_V1_PACKAGE_NAME,
} from "@contracts/auth";
import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { ClientsModule, Transport } from "@nestjs/microservices";
import { AuthController } from "./auth/auth.controller";
import { AuthUserGuard } from "./auth/auth-user.guard";
import { ConfigModule } from "./config/config.module";
import { ConfigService } from "./config/config.service";
import { GatewayController } from "./gateway.controller";

@Module({
    imports: [
        ConfigModule,
        JwtModule.register({}),
        ClientsModule.registerAsync([
            {
                name: "SCORING_SERVICE",
                imports: [ConfigModule],
                inject: [ConfigService],
                useFactory: (config: ConfigService) => ({
                    transport: Transport.TCP,
                    options: {
                        host: config.scoringHost,
                        port: config.scoringPort,
                    },
                }),
            },
            {
                name: "AUTH_CLIENT",
                imports: [ConfigModule],
                inject: [ConfigService],
                useFactory: (config: ConfigService) => ({
                    transport: Transport.GRPC,
                    options: {
                        package: AUTH_V1_PACKAGE_NAME,
                        protoPath: AUTH_PROTO_PATH,
                        url: `${config.authGrpcHost}:${config.authGrpcPort}`,
                    },
                }),
            },
        ]),
    ],
    controllers: [GatewayController, AuthController],
    providers: [AuthUserGuard],
})
export class AppModule {}
