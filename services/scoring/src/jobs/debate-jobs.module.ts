import { Module } from '@nestjs/common';
import { QUEUE_NAMES, redisConnectionFromEnv } from '@repo/queue';
import { Queue } from 'bullmq';
import { DebateJobsProducer, FINALIZATION_QUEUE } from './debate-jobs.producer';

@Module({
    providers: [
        {
            provide: FINALIZATION_QUEUE,
            useFactory: () =>
                new Queue(QUEUE_NAMES.FINALIZATION, {
                    connection: redisConnectionFromEnv(),
                }),
        },
        DebateJobsProducer,
    ],
    exports: [DebateJobsProducer],
})
export class DebateJobsModule {}
