import {
    AUTH_PROTO_PATH,
    AUTH_V1_PACKAGE_NAME,
} from "@contracts/auth";
import {
    MATCHMAKING_PROTO_PATH,
    MATCHMAKING_V1_PACKAGE_NAME,
} from "@contracts/matchmaking";
import {
    SCORING_PROTO_PATH,
    SCORING_V1_PACKAGE_NAME,
} from "@contracts/scoring";
import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { ClientsModule, Transport } from "@nestjs/microservices";
import { AuthController } from "./auth/auth.controller";
import { AuthUserGuard } from "./auth/auth-user.guard";
import { ConfigModule } from "./config/config.module";
import { ConfigService } from "./config/config.service";
import { GatewayController } from "./gateway.controller";
import { MatchmakingController } from "./matchmaking/matchmaking.controller";

@Module({
    imports: [
        ConfigModule,
        JwtModule.register({}),
        ClientsModule.registerAsync([
            {
                name: "SCORING_CLIENT",
                imports: [ConfigModule],
                inject: [ConfigService],
                useFactory: (config: ConfigService) => ({
                    transport: Transport.GRPC,
                    options: {
                        package: SCORING_V1_PACKAGE_NAME,
                        protoPath: SCORING_PROTO_PATH,
                        url: `${config.scoringGrpcHost}:${config.scoringGrpcPort}`,
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
            {
                name: "MATCHMAKING_CLIENT",
                imports: [ConfigModule],
                inject: [ConfigService],
                useFactory: (config: ConfigService) => ({
                    transport: Transport.GRPC,
                    options: {
                        package: MATCHMAKING_V1_PACKAGE_NAME,
                        protoPath: MATCHMAKING_PROTO_PATH,
                        url: `${config.matchmakingGrpcHost}:${config.matchmakingGrpcPort}`,
                    },
                }),
            },
        ]),
    ],
    controllers: [AuthController, GatewayController, MatchmakingController],
    providers: [AuthUserGuard],
})
export class AppModule {}
