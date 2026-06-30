import { describe, expect, it } from 'vitest';
import { resolveLogLevels } from './resolve-log-levels';

describe('resolveLogLevels', () => {
    it('returns the requested level and every higher-severity level', () => {
        expect(resolveLogLevels('warn')).toEqual(['warn', 'error', 'fatal']);
    });

    it('is case-insensitive', () => {
        expect(resolveLogLevels('WARN')).toEqual(['warn', 'error', 'fatal']);
    });

    it('defaults to "log" when unset', () => {
        expect(resolveLogLevels(undefined)).toEqual(['log', 'warn', 'error', 'fatal']);
    });

    it('defaults to "log" when empty string', () => {
        expect(resolveLogLevels('')).toEqual(['log', 'warn', 'error', 'fatal']);
    });

    it('falls back to "log" on an unrecognized value', () => {
        expect(resolveLogLevels('nonsense')).toEqual(['log', 'warn', 'error', 'fatal']);
    });

    it('returns every level at "verbose"', () => {
        expect(resolveLogLevels('verbose')).toEqual([
            'verbose',
            'debug',
            'log',
            'warn',
            'error',
            'fatal',
        ]);
    });
});
