import { Injectable, type LogLevel } from '@nestjs/common';
import { parseBool, parsePort, resolveLogLevels } from '@repo/common';

@Injectable()
export class ConfigService {
    get grpcHost(): string {
        return process.env.SCORING_GRPC_HOST ?? '127.0.0.1';
    }
    get grpcPort(): number {
        return parsePort('SCORING_GRPC_PORT', 50052);
    }

    get dbHost(): string {
        return process.env.SCORING_DB_HOST ?? '127.0.0.1';
    }
    get dbPort(): number {
        return parsePort('SCORING_DB_PORT', 5432);
    }
    get dbUser(): string {
        return process.env.SCORING_DB_USER ?? 'scoring';
    }
    get dbPassword(): string {
        return process.env.SCORING_DB_PASSWORD ?? 'scoring';
    }
    get dbName(): string {
        return process.env.SCORING_DB_NAME ?? 'scoring';
    }
    get skipMigrations(): boolean {
        return parseBool('SCORING_SKIP_MIGRATIONS', false);
    }

    get logLevels(): LogLevel[] {
        return resolveLogLevels();
    }
}
