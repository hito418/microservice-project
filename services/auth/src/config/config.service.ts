import * as fs from 'node:fs';
import { Injectable, type LogLevel } from '@nestjs/common';
import { parseBool, parsePort, resolveLogLevels } from '@repo/common';

const SUPPORTED_JWT_ALGORITHMS = ['ES256', 'ES384', 'RS256', 'RS384'] as const;
export type JwtAlgorithm = (typeof SUPPORTED_JWT_ALGORITHMS)[number];

const DEFAULT_JWT_ALGORITHM: JwtAlgorithm = 'ES256';
const DEFAULT_JWT_EXPIRES_IN_SECONDS = 60 * 60;

@Injectable()
export class ConfigService {
    get grpcHost(): string {
        return process.env.AUTH_GRPC_HOST ?? '127.0.0.1';
    }
    get grpcPort(): number {
        return parsePort('AUTH_GRPC_PORT', 50051);
    }

    get dbHost(): string {
        return process.env.AUTH_DB_HOST ?? '127.0.0.1';
    }
    get dbPort(): number {
        return parsePort('AUTH_DB_PORT', 5432);
    }
    get dbUser(): string {
        return process.env.AUTH_DB_USER ?? 'auth';
    }
    get dbPassword(): string {
        return process.env.AUTH_DB_PASSWORD ?? 'auth';
    }
    get dbName(): string {
        return process.env.AUTH_DB_NAME ?? 'auth';
    }
    get skipMigrations(): boolean {
        return parseBool('AUTH_SKIP_MIGRATIONS', false);
    }

    get profileGrpcHost(): string {
        return process.env.PROFILE_GRPC_HOST ?? '127.0.0.1';
    }
    get profileGrpcPort(): number {
        return parsePort('PROFILE_GRPC_PORT', 50053);
    }

    private _jwtPrivateKey?: string;
    get jwtPrivateKey(): string {
        return (this._jwtPrivateKey ??= readJwtPrivateKey());
    }
    get jwtAlgorithm(): JwtAlgorithm {
        return resolveJwtAlgorithm(process.env.JWT_ALGORITHM);
    }
    get jwtExpiresInSeconds(): number {
        return resolveJwtExpiresIn(process.env.JWT_EXPIRES_IN);
    }

    get logLevels(): LogLevel[] {
        return resolveLogLevels();
    }
}

function readJwtPrivateKey(): string {
    const path = process.env.JWT_PRIVATE_KEY_PATH?.trim();
    if (path) {
        return fs.readFileSync(path, 'utf8');
    }
    // Env strings can't carry real newlines on most platforms, so accept `\n`
    // literals (the conventional shell-escape) and unescape them.
    const inline = process.env.JWT_PRIVATE_KEY?.trim();
    if (inline) {
        return inline.replace(/\\n/g, '\n');
    }
    throw new Error('JWT_PRIVATE_KEY or JWT_PRIVATE_KEY_PATH is required');
}

function resolveJwtAlgorithm(raw: string | undefined): JwtAlgorithm {
    if (!raw) return DEFAULT_JWT_ALGORITHM;
    const v = raw.trim();
    if (!(SUPPORTED_JWT_ALGORITHMS as readonly string[]).includes(v)) {
        throw new Error(
            `JWT_ALGORITHM must be one of ${SUPPORTED_JWT_ALGORITHMS.join(', ')}, got "${raw}"`,
        );
    }
    return v as JwtAlgorithm;
}

function resolveJwtExpiresIn(raw: string | undefined): number {
    if (!raw) return DEFAULT_JWT_EXPIRES_IN_SECONDS;
    const v = raw.trim();
    const n = Number(v);
    if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) {
        throw new Error(`JWT_EXPIRES_IN must be a positive integer (seconds), got "${raw}"`);
    }
    return n;
}
