import { Injectable, type LogLevel } from '@nestjs/common';
import { parseBool, parsePort, resolveLogLevels } from '@repo/common';

@Injectable()
export class ConfigService {
    get grpcHost(): string {
        return process.env.PROFILE_GRPC_HOST ?? '127.0.0.1';
    }
    get grpcPort(): number {
        return parsePort('PROFILE_GRPC_PORT', 50053);
    }

    get dbHost(): string {
        return process.env.PROFILE_DB_HOST ?? '127.0.0.1';
    }
    get dbPort(): number {
        return parsePort('PROFILE_DB_PORT', 5432);
    }
    get dbUser(): string {
        return process.env.PROFILE_DB_USER ?? 'profile';
    }
    get dbPassword(): string {
        return process.env.PROFILE_DB_PASSWORD ?? 'profile';
    }
    get dbName(): string {
        return process.env.PROFILE_DB_NAME ?? 'profile';
    }
    get skipMigrations(): boolean {
        return parseBool('PROFILE_SKIP_MIGRATIONS', false);
    }

    get logLevels(): LogLevel[] {
        return resolveLogLevels();
    }
}
