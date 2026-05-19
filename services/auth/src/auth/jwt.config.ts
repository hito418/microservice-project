import * as fs from 'node:fs';

const SUPPORTED_ALGORITHMS = ['ES256', 'ES384', 'RS256', 'RS384'] as const;
export type JwtAlgorithm = (typeof SUPPORTED_ALGORITHMS)[number];

const DEFAULT_ALGORITHM: JwtAlgorithm = 'ES256';
const DEFAULT_EXPIRES_IN_SECONDS = 60 * 60; // 1 hour

export interface JwtConfig {
    privateKey: string;
    algorithm: JwtAlgorithm;
    expiresInSeconds: number;
}

export function resolveJwtConfig(env: NodeJS.ProcessEnv = process.env): JwtConfig {
    return {
        privateKey: resolvePrivateKey(env),
        algorithm: resolveAlgorithm(env.JWT_ALGORITHM),
        expiresInSeconds: resolveExpiresIn(env.JWT_EXPIRES_IN),
    };
}

function resolvePrivateKey(env: NodeJS.ProcessEnv): string {
    const path = env.JWT_PRIVATE_KEY_PATH?.trim();
    if (path) {
        return fs.readFileSync(path, 'utf8');
    }
    // Env strings can't carry real newlines on most platforms, so accept `\n`
    // literals (the conventional shell-escape) and unescape them.
    const inline = env.JWT_PRIVATE_KEY?.trim();
    if (inline) {
        return inline.replace(/\\n/g, '\n');
    }
    throw new Error('JWT_PRIVATE_KEY or JWT_PRIVATE_KEY_PATH is required');
}

function resolveAlgorithm(raw: string | undefined): JwtAlgorithm {
    if (!raw) return DEFAULT_ALGORITHM;
    const v = raw.trim();
    if (!isSupportedAlgorithm(v)) {
        throw new Error(
            `JWT_ALGORITHM must be one of ${SUPPORTED_ALGORITHMS.join(', ')}, got "${raw}"`,
        );
    }
    return v;
}

function isSupportedAlgorithm(raw: string): raw is JwtAlgorithm {
    return (SUPPORTED_ALGORITHMS as readonly string[]).includes(raw);
}

function resolveExpiresIn(raw: string | undefined): number {
    if (!raw) return DEFAULT_EXPIRES_IN_SECONDS;
    const v = raw.trim();
    const n = Number(v);
    if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) {
        throw new Error(`JWT_EXPIRES_IN must be a positive integer (seconds), got "${raw}"`);
    }
    return n;
}
