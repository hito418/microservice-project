import { Injectable, type LogLevel } from '@nestjs/common';
import { parseBool, parsePort, resolveLogLevels } from '@repo/common';

@Injectable()
export class ConfigService {
    get grpcHost(): string {
        return process.env.RANKING_GRPC_HOST ?? '127.0.0.1';
    }
    get grpcPort(): number {
        return parsePort('RANKING_GRPC_PORT', 50055);
    }

    get dbHost(): string {
        return process.env.RANKING_DB_HOST ?? '127.0.0.1';
    }
    get dbPort(): number {
        return parsePort('RANKING_DB_PORT', 5432);
    }
    get dbUser(): string {
        return process.env.RANKING_DB_USER ?? 'ranking';
    }
    get dbPassword(): string {
        return process.env.RANKING_DB_PASSWORD ?? 'ranking';
    }
    get dbName(): string {
        return process.env.RANKING_DB_NAME ?? 'ranking';
    }
    get skipMigrations(): boolean {
        return parseBool('RANKING_SKIP_MIGRATIONS', false);
    }

    get scoringGrpcHost(): string {
        return process.env.SCORING_GRPC_HOST ?? '127.0.0.1';
    }
    get scoringGrpcPort(): number {
        return parsePort('SCORING_GRPC_PORT', 50052);
    }

    get profileGrpcHost(): string {
        return process.env.PROFILE_GRPC_HOST ?? '127.0.0.1';
    }
    get profileGrpcPort(): number {
        return parsePort('PROFILE_GRPC_PORT', 50053);
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
