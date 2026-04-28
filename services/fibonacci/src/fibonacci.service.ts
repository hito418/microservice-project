import { BadRequestException, Injectable } from '@nestjs/common';

@Injectable()
export class FibonacciService {
    compute(n: number): number {
        if (!Number.isInteger(n) || n < 0) {
            throw new BadRequestException('n must be a non-negative integer');
        }
        // F(79) overflows Number.MAX_SAFE_INTEGER.
        if (n > 78) {
            throw new BadRequestException('n must be <= 78 to stay within safe integer range');
        }

        let a = 0;
        let b = 1;
        for (let i = 0; i < n; i++) {
            [a, b] = [b, a + b];
        }
        return a;
    }
}
