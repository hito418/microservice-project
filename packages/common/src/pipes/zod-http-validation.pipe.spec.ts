import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ZodHttpValidationPipe } from './zod-http-validation.pipe';

const schema = z
    .object({
        email: z.string().trim().email(),
        password: z.string().min(8),
    })
    .strict();

describe('ZodHttpValidationPipe', () => {
    const pipe = new ZodHttpValidationPipe(schema);

    it('returns parsed value with transforms applied', () => {
        const out = pipe.transform({
            email: '  Alice@Example.com ',
            password: 'hunter22!',
        });
        expect(out).toEqual({
            email: 'Alice@Example.com',
            password: 'hunter22!',
        });
    });

    it('throws BadRequestException on invalid input', () => {
        try {
            pipe.transform({ email: 'nope', password: 'short' });
            expect.fail('expected BadRequestException');
        } catch (err) {
            expect(err).toBeInstanceOf(BadRequestException);
            const response = (err as BadRequestException).getResponse() as {
                message: string;
                issues: unknown[];
            };
            expect(response.message).toBe('validation failed');
            expect(Array.isArray(response.issues)).toBe(true);
        }
    });

    it('rejects unknown fields (strict)', () => {
        expect(() =>
            pipe.transform({
                email: 'a@b.co',
                password: 'hunter22!',
                role: 'admin',
            }),
        ).toThrow(BadRequestException);
    });
});
