export interface AuthCookieConfig {
    name: string;
    secure: boolean;
    sameSite: 'lax' | 'strict' | 'none';
    path: string;
}

export const AUTH_COOKIE_DEFAULT_NAME = 'auth_token';

export function resolveAuthCookieConfig(
    env: NodeJS.ProcessEnv = process.env,
): AuthCookieConfig {
    return {
        name: env.AUTH_COOKIE_NAME?.trim() || AUTH_COOKIE_DEFAULT_NAME,
        // Browsers reject Secure cookies over plain HTTP, so default to true in
        // production and false elsewhere. Override with AUTH_COOKIE_SECURE.
        secure: parseBool(env.AUTH_COOKIE_SECURE, env.NODE_ENV === 'production'),
        sameSite: parseSameSite(env.AUTH_COOKIE_SAMESITE) ?? 'lax',
        path: '/',
    };
}

function parseBool(raw: string | undefined, fallback: boolean): boolean {
    if (raw === undefined) return fallback;
    const v = raw.trim().toLowerCase();
    if (v === 'true' || v === '1') return true;
    if (v === 'false' || v === '0') return false;
    return fallback;
}

function parseSameSite(
    raw: string | undefined,
): 'lax' | 'strict' | 'none' | undefined {
    if (!raw) return undefined;
    const v = raw.trim().toLowerCase();
    if (v === 'lax' || v === 'strict' || v === 'none') return v;
    return undefined;
}
