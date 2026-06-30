import type { Job } from 'bullmq';

/**
 * Injection token a runner binds to its concrete processor:
 * `{ provide: JOB_PROCESSOR, useClass: MyProcessor }`. The bootstrap helper
 * resolves the processor by this token from the Nest application context.
 */
export const JOB_PROCESSOR = Symbol('JOB_PROCESSOR');

/**
 * A processor handles one job at a time for a single queue. Returning normally
 * marks the job complete; throwing lets BullMQ apply the queue's retry policy.
 */
export interface JobProcessor<T> {
    process(job: Job<T>): Promise<unknown>;
}
