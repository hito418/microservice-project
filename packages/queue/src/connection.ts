import { parsePort } from '@repo/common';
import type { ConnectionOptions } from 'bullmq';

const DEFAULT_PORT = 6379;

export function redisConnectionFromEnv(): ConnectionOptions {
    return {
        host: process.env.REDIS_HOST || '127.0.0.1',
        port: parsePort(process.env.REDIS_PORT, DEFAULT_PORT),
        password: process.env.REDIS_PASSWORD || undefined,
    };
}
