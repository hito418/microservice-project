import { status } from '@grpc/grpc-js';
import { RpcException } from '@nestjs/microservices';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ZodRpcValidationPipe } from './zod-rpc-validation.pipe';

const schema = z
    .object({
        email: z.string().trim().email(),
        password: z.string().min(8),
    })
    .strict();

describe('ZodRpcValidationPipe', () => {
    const pipe = new ZodRpcValidationPipe(schema);

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

    it('throws RpcException(INVALID_ARGUMENT) on invalid input', () => {
        try {
            pipe.transform({ email: 'nope', password: 'short' });
            expect.fail('expected RpcException');
        } catch (err) {
            expect(err).toBeInstanceOf(RpcException);
            const error = (err as RpcException).getError() as {
                code: number;
                message: string;
            };
            expect(error.code).toBe(status.INVALID_ARGUMENT);
            expect(error.message).toBe('validation failed');
        }
    });

    it('rejects unknown fields (strict)', () => {
        expect(() =>
            pipe.transform({
                email: 'a@b.co',
                password: 'hunter22!',
                role: 'admin',
            }),
        ).toThrow(RpcException);
    });
});
