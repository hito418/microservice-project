import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { FibonacciService } from './fibonacci.service';

@Controller()
export class FibonacciController {
    constructor(private readonly fibonacci: FibonacciService) {}

    @MessagePattern({ cmd: 'fibonacci.compute' })
    compute(@Payload() payload: { n: number }): number {
        return this.fibonacci.compute(payload.n);
    }
}
