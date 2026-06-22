import { Injectable, type LogLevel } from '@nestjs/common';
import { parseBool, parsePort, resolveLogLevels } from '@repo/common';

@Injectable()
export class ConfigService {
    get grpcHost(): string {
        return process.env.DEBATE_GRPC_HOST ?? '127.0.0.1';
    }
    get grpcPort(): number {
        return parsePort('DEBATE_GRPC_PORT', 50053);
    }

    get dbHost(): string {
        return process.env.DEBATE_DB_HOST ?? '127.0.0.1';
    }
    get dbPort(): number {
        return parsePort('DEBATE_DB_PORT', 5432);
    }
    get dbUser(): string {
        return process.env.DEBATE_DB_USER ?? 'debate';
    }
    get dbPassword(): string {
        return process.env.DEBATE_DB_PASSWORD ?? 'debate';
    }
    get dbName(): string {
        return process.env.DEBATE_DB_NAME ?? 'debate';
    }
    get skipMigrations(): boolean {
        return parseBool('DEBATE_SKIP_MIGRATIONS', false);
    }

    get logLevels(): LogLevel[] {
        return resolveLogLevels();
    }
}
