import { afterEach, describe, expect, it } from 'vitest';
import { parsePort } from './parse-port';

const VAR = 'TEST_PARSE_PORT_VAR';

afterEach(() => {
    delete process.env[VAR];
});

describe('parsePort', () => {
    it('returns the fallback when the env var is unset', () => {
        expect(parsePort(VAR, 3000)).toBe(3000);
    });

    it('returns the fallback when the env var is an empty string', () => {
        process.env[VAR] = '';
        expect(parsePort(VAR, 3000)).toBe(3000);
    });

    it('parses a valid integer string', () => {
        process.env[VAR] = '5432';
        expect(parsePort(VAR, 3000)).toBe(5432);
    });

    it('accepts the boundary values 1 and 65535', () => {
        process.env[VAR] = '1';
        expect(parsePort(VAR, 3000)).toBe(1);
        process.env[VAR] = '65535';
        expect(parsePort(VAR, 3000)).toBe(65535);
    });

    it('throws an error that names the env var on a non-numeric string', () => {
        process.env[VAR] = 'abc';
        expect(() => parsePort(VAR, 3000)).toThrow(
            new RegExp(`${VAR} must be an integer between 1 and 65535, got "abc"`),
        );
    });

    it('throws on a non-integer value', () => {
        process.env[VAR] = '3.14';
        expect(() => parsePort(VAR, 3000)).toThrow(VAR);
    });

    it('throws on a value below 1', () => {
        process.env[VAR] = '0';
        expect(() => parsePort(VAR, 3000)).toThrow(VAR);
    });

    it('throws on a value above 65535', () => {
        process.env[VAR] = '70000';
        expect(() => parsePort(VAR, 3000)).toThrow(VAR);
    });
});
