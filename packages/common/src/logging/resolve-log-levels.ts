import type { LogLevel } from '@nestjs/common';

const LEVEL_ORDER: readonly LogLevel[] = [
    'verbose',
    'debug',
    'log',
    'warn',
    'error',
    'fatal',
];

export function resolveLogLevels(raw: string | undefined = process.env.LOG_LEVEL): LogLevel[] {
    const requested = (raw ?? 'log').toLowerCase();
    const idx = LEVEL_ORDER.indexOf(requested as LogLevel);
    const start = idx === -1 ? LEVEL_ORDER.indexOf('log') : idx;
    return LEVEL_ORDER.slice(start);
}
