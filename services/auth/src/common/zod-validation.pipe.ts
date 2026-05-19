import { status } from '@grpc/grpc-js';
import { PipeTransform } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import type { ZodSchema } from 'zod';

export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
    constructor(private readonly schema: ZodSchema<T>) {}

    transform(value: unknown): T {
        const result = this.schema.safeParse(value);
        if (!result.success) {
            throw new RpcException({
                code: status.INVALID_ARGUMENT,
                message: 'validation failed',
                details: result.error.issues,
            });
        }
        return result.data;
    }
}
