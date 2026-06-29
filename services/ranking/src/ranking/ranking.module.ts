import {
    PROFILE_PROTO_PATH,
    PROFILE_V1_PACKAGE_NAME,
} from '@contracts/profile';
import {
    SCORING_PROTO_PATH,
    SCORING_V1_PACKAGE_NAME,
} from '@contracts/scoring';
import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule } from '../config/config.module';
import { ConfigService } from '../config/config.service';
import { DatabaseModule } from '../db/database.module';
import { RankingController } from './ranking.controller';
import { RankingRepository } from './ranking.repository';
import { RankingService } from './ranking.service';

@Module({
    imports: [
        DatabaseModule,
        ClientsModule.registerAsync([
            {
                name: 'SCORING_CLIENT',
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
                name: 'PROFILE_CLIENT',
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
        ]),
    ],
    controllers: [RankingController],
    providers: [RankingRepository, RankingService],
})
export class RankingModule {}
