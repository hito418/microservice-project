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

    get logLevels(): LogLevel[] {
        return resolveLogLevels();
    }
}
