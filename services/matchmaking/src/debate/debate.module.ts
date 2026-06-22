import path from 'node:path';
import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule } from '../config/config.module';
import { ConfigService } from '../config/config.service';
import { DEBATE_V1_PACKAGE_NAME } from './debate-client.types';

export const DEBATE_CLIENT = 'DEBATE_CLIENT';

const DEBATE_PROTO_PATH = path.join(__dirname, 'debate.proto');

@Module({
    imports: [
        ClientsModule.registerAsync([
            {
                name: DEBATE_CLIENT,
                imports: [ConfigModule],
                inject: [ConfigService],
                useFactory: (config: ConfigService) => ({
                    transport: Transport.GRPC,
                    options: {
                        package: DEBATE_V1_PACKAGE_NAME,
                        protoPath: DEBATE_PROTO_PATH,
                        url: `${config.debateGrpcHost}:${config.debateGrpcPort}`,
                    },
                }),
            },
        ]),
    ],
    exports: [ClientsModule],
})
export class DebateModule {}
