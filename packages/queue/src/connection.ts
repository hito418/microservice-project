import { ConnectionOptions } from 'bullmq';

const DEFAULT_PORT = 6379;

export function redisConnectionFromEnv(): ConnectionOptions {
    const host = process.env.REDIS_HOST ?? '127.0.0.1';
    const port = parsePort(process.env.REDIS_PORT, DEFAULT_PORT);
    const password = process.env.REDIS_PASSWORD || undefined;
    return {
        host,
        port,
        password,
        maxRetriesPerRequest: null,
    };
}

function parsePort(raw: string | undefined, fallback: number): number {
    if (raw === undefined || raw === '') return fallback;
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 1 || n > 65535) {
        throw new Error(`REDIS_PORT must be an integer between 1 and 65535, got "${raw}"`);
    }
    return n;
}
