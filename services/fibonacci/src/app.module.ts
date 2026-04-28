import { Module } from '@nestjs/common';
import { FibonacciController } from './fibonacci.controller';
import { FibonacciService } from './fibonacci.service';

@Module({
    controllers: [FibonacciController],
    providers: [FibonacciService],
})
export class AppModule {}
