import { describe, expect, it } from 'vitest';
import { parsePort } from './parse-port';

describe('parsePort', () => {
    it('returns the fallback when raw is undefined', () => {
        expect(parsePort(undefined, 3000)).toBe(3000);
    });

    it('returns the fallback when raw is an empty string', () => {
        expect(parsePort('', 3000)).toBe(3000);
    });

    it('parses a valid integer string', () => {
        expect(parsePort('5432', 3000)).toBe(5432);
    });

    it('accepts the boundary values 1 and 65535', () => {
        expect(parsePort('1', 3000)).toBe(1);
        expect(parsePort('65535', 3000)).toBe(65535);
    });

    it('throws on a non-numeric string', () => {
        expect(() => parsePort('abc', 3000)).toThrow(/abc/);
    });

    it('throws on a non-integer value', () => {
        expect(() => parsePort('3.14', 3000)).toThrow();
    });

    it('throws on a value below 1', () => {
        expect(() => parsePort('0', 3000)).toThrow();
    });

    it('throws on a value above 65535', () => {
        expect(() => parsePort('70000', 3000)).toThrow();
    });
});
