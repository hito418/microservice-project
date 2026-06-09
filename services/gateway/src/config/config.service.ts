import * as fs from 'node:fs';
import { Injectable, type LogLevel } from '@nestjs/common';
import { parseBool, parsePort, resolveLogLevels } from '@repo/common';

export const AUTH_COOKIE_DEFAULT_NAME = 'auth_token';

export type SameSiteMode = 'lax' | 'strict' | 'none';

const SUPPORTED_JWT_ALGORITHMS = ['ES256', 'ES384', 'RS256', 'RS384'] as const;
export type JwtAlgorithm = (typeof SUPPORTED_JWT_ALGORITHMS)[number];

const DEFAULT_JWT_ALGORITHM: JwtAlgorithm = 'ES256';

@Injectable()
export class ConfigService {
    get httpHost(): string {
        return process.env.GATEWAY_HOST ?? '127.0.0.1';
    }
    get httpPort(): number {
        return parsePort('GATEWAY_PORT', 3000);
    }

    get scoringGrpcHost(): string {
        return process.env.SCORING_GRPC_HOST ?? '127.0.0.1';
    }
    get scoringGrpcPort(): number {
        return parsePort('SCORING_GRPC_PORT', 50052);
    }

    get authGrpcHost(): string {
        return process.env.AUTH_GRPC_HOST ?? '127.0.0.1';
    }
    get authGrpcPort(): number {
        return parsePort('AUTH_GRPC_PORT', 50051);
    }

    get authCookieName(): string {
        return process.env.AUTH_COOKIE_NAME?.trim() || AUTH_COOKIE_DEFAULT_NAME;
    }
    get authCookieSecure(): boolean {
        // Browsers reject Secure cookies over plain HTTP, so default to true in
        // production and false elsewhere. Override with AUTH_COOKIE_SECURE.
        return parseBool('AUTH_COOKIE_SECURE', process.env.NODE_ENV === 'production');
    }
    get authCookieSameSite(): SameSiteMode {
        return parseSameSite(process.env.AUTH_COOKIE_SAMESITE) ?? 'lax';
    }
    get authCookiePath(): string {
        return '/';
    }

    private _jwtPublicKey?: string;
    get jwtPublicKey(): string {
        return (this._jwtPublicKey ??= readJwtPublicKey());
    }
    get jwtAlgorithm(): JwtAlgorithm {
        return resolveJwtAlgorithm(process.env.JWT_ALGORITHM);
    }

    get logLevels(): LogLevel[] {
        return resolveLogLevels();
    }
}

function parseSameSite(raw: string | undefined): SameSiteMode | undefined {
    if (!raw) return undefined;
    const v = raw.trim().toLowerCase();
    if (v === 'lax' || v === 'strict' || v === 'none') return v;
    return undefined;
}

function readJwtPublicKey(): string {
    const path = process.env.JWT_PUBLIC_KEY_PATH?.trim();
    if (path) {
        return fs.readFileSync(path, 'utf8');
    }
    // Env strings can't carry real newlines on most platforms, so accept `\n`
    // literals (the conventional shell-escape) and unescape them.
    const inline = process.env.JWT_PUBLIC_KEY?.trim();
    if (inline) {
        return inline.replace(/\\n/g, '\n');
    }
    throw new Error('JWT_PUBLIC_KEY or JWT_PUBLIC_KEY_PATH is required');
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
