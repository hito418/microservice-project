const DEFAULT_EXPIRES_IN_SECONDS = 60 * 60; // 1 hour

export interface JwtConfig {
    secret: string;
    expiresInSeconds: number;
}

export function resolveJwtConfig(env: NodeJS.ProcessEnv = process.env): JwtConfig {
    const secret = env.JWT_SECRET?.trim();
    if (!secret) {
        throw new Error('JWT_SECRET is required');
    }

    const raw = env.JWT_EXPIRES_IN?.trim();
    const expiresInSeconds = raw ? parseExpiresIn(raw) : DEFAULT_EXPIRES_IN_SECONDS;

    return { secret, expiresInSeconds };
}

function parseExpiresIn(raw: string): number {
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) {
        throw new Error(`JWT_EXPIRES_IN must be a positive integer (seconds), got "${raw}"`);
    }
    return n;
}
