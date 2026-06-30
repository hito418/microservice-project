import { SCORING_PROTO_PATH, SCORING_V1_PACKAGE_NAME } from '@contracts/scoring';
import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { parsePort } from '@repo/common';
import { SCORING_CLIENT, ScoringClient } from './scoring-client.service';

const DEFAULT_SCORING_GRPC_PORT = 50052;

/**
 * Registers the scoring gRPC client (mirrors the gateway's wiring) and the
 * Promise-based ScoringClient facade.
 */
@Module({
    imports: [
        ClientsModule.registerAsync([
            {
                name: SCORING_CLIENT,
                useFactory: () => ({
                    transport: Transport.GRPC,
                    options: {
                        package: SCORING_V1_PACKAGE_NAME,
                        protoPath: SCORING_PROTO_PATH,
                        url: `${process.env.SCORING_GRPC_HOST ?? '127.0.0.1'}:${parsePort(
                            'SCORING_GRPC_PORT',
                            DEFAULT_SCORING_GRPC_PORT,
                        )}`,
                    },
                }),
            },
        ]),
    ],
    providers: [ScoringClient],
    exports: [ScoringClient],
})
export class ScoringClientModule {}
