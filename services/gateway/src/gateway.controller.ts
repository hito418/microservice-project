import {
    BadRequestException,
    Controller,
    Get,
    Inject,
    Param,
    ParseIntPipe,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';

@Controller()
export class GatewayController {
    constructor(
        @Inject('FIBONACCI_SERVICE') private readonly fibonacciClient: ClientProxy,
    ) {}

    @Get('fibonacci/:n')
    async fibonacci(
        @Param('n', ParseIntPipe) n: number,
    ): Promise<{ n: number; value: number }> {
        if (n < 0) {
            throw new BadRequestException('n must be a non-negative integer');
        }
        const value = await firstValueFrom(
            this.fibonacciClient.send<number>({ cmd: 'fibonacci.compute' }, { n }),
        );
        return { n, value };
    }
}
