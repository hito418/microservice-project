import { ConnectionOptions } from 'bullmq';

export function redisConnectionFromEnv(): ConnectionOptions {
    const host = process.env.REDIS_HOST ?? '127.0.0.1';
    const port = Number(process.env.REDIS_PORT ?? 6379);
    const password = process.env.REDIS_PASSWORD || undefined;
    return {
        host,
        port,
        password,
        maxRetriesPerRequest: null,
    };
}
