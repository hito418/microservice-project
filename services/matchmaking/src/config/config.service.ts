import { Injectable, type LogLevel } from '@nestjs/common';
import { parsePort, resolveLogLevels } from '@repo/common';

@Injectable()
export class ConfigService {
    get grpcHost(): string {
        return process.env.MATCHMAKING_GRPC_HOST ?? '127.0.0.1';
    }
    get grpcPort(): number {
        return parsePort('MATCHMAKING_GRPC_PORT', 50054);
    }

    get redisHost(): string {
        return process.env.REDIS_HOST ?? '127.0.0.1';
    }
    get redisPort(): number {
        return parsePort('REDIS_PORT', 6379);
    }
    get redisPassword(): string | undefined {
        return process.env.REDIS_PASSWORD || undefined;
    }

    get logLevels(): LogLevel[] {
        return resolveLogLevels();
    }
}
