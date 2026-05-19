import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ZodValidationPipe } from './zod-validation.pipe';

const schema = z
    .object({
        email: z.string().trim().email(),
        password: z.string().min(8),
    })
    .strict();

describe('ZodValidationPipe', () => {
    const pipe = new ZodValidationPipe(schema);

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
        expect(() =>
            pipe.transform({ email: 'nope', password: 'short' }),
        ).toThrow(BadRequestException);
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
