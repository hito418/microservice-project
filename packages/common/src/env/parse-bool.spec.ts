import { afterEach, describe, expect, it } from 'vitest';
import { parseBool } from './parse-bool';

const VAR = 'TEST_PARSE_BOOL_VAR';

afterEach(() => {
    delete process.env[VAR];
});

describe('parseBool', () => {
    it('returns the fallback when the env var is unset', () => {
        expect(parseBool(VAR, true)).toBe(true);
        expect(parseBool(VAR, false)).toBe(false);
    });

    it.each([
        ['true', true],
        ['TRUE', true],
        ['  true ', true],
        ['1', true],
        ['false', false],
        ['FALSE', false],
        ['0', false],
    ])('parses %s as %s', (raw, expected) => {
        process.env[VAR] = raw;
        expect(parseBool(VAR, !expected)).toBe(expected);
    });

    it('returns the fallback on an unrecognized value', () => {
        process.env[VAR] = 'maybe';
        expect(parseBool(VAR, true)).toBe(true);
        expect(parseBool(VAR, false)).toBe(false);
    });

    it('accepts an explicit env map', () => {
        const env: NodeJS.ProcessEnv = { [VAR]: 'true' };
        expect(parseBool(VAR, false, env)).toBe(true);
    });
});
