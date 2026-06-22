import { Global, Module, type OnApplicationShutdown } from '@nestjs/common';
import Redis from 'ioredis';
import { ConfigService } from '../config/config.service';

export const REDIS = Symbol('REDIS');

@Global()
@Module({
    providers: [
        {
            provide: REDIS,
            inject: [ConfigService],
            useFactory: (config: ConfigService) =>
                new Redis({
                    host: config.redisHost,
                    port: config.redisPort,
                    password: config.redisPassword,
                    lazyConnect: false,
                }),
        },
    ],
    exports: [REDIS],
})
export class RedisModule implements OnApplicationShutdown {
    constructor() {}

    async onApplicationShutdown(): Promise<void> {
        // ioredis client is closed by the consumer (MatchmakingRepository)
    }
}
