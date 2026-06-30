import {
    AUTH_PROTO_PATH,
    AUTH_V1_PACKAGE_NAME,
} from "@contracts/auth";
import {
    PROFILE_PROTO_PATH,
    PROFILE_V1_PACKAGE_NAME,
} from "@contracts/profile";
import {
    RANKING_PROTO_PATH,
    RANKING_V1_PACKAGE_NAME,
} from "@contracts/ranking";
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
import { RealtimeModule } from "./realtime/realtime.module";

@Module({
    imports: [
        ConfigModule,
        RealtimeModule,
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
                name: "PROFILE_CLIENT",
                imports: [ConfigModule],
                inject: [ConfigService],
                useFactory: (config: ConfigService) => ({
                    transport: Transport.GRPC,
                    options: {
                        package: PROFILE_V1_PACKAGE_NAME,
                        protoPath: PROFILE_PROTO_PATH,
                        url: `${config.profileGrpcHost}:${config.profileGrpcPort}`,
                    },
                }),
            },
            {
                name: "RANKING_CLIENT",
                imports: [ConfigModule],
                inject: [ConfigService],
                useFactory: (config: ConfigService) => ({
                    transport: Transport.GRPC,
                    options: {
                        package: RANKING_V1_PACKAGE_NAME,
                        protoPath: RANKING_PROTO_PATH,
                        url: `${config.rankingGrpcHost}:${config.rankingGrpcPort}`,
                    },
                }),
            },
        ]),
    ],
    controllers: [AuthController, GatewayController],
    providers: [AuthUserGuard],
})
export class AppModule {}
