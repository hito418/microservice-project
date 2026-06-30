import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import {
    DEFAULT_JOB_OPTIONS,
    FINALIZATION_DELAY_MS,
    type FinalizationJob,
    QUEUE_NAMES,
} from '@repo/queue';
import { Queue } from 'bullmq';

export const FINALIZATION_QUEUE = 'FINALIZATION_QUEUE';

/**
 * Enqueues debate-lifecycle background jobs. `jobId` is keyed on the debate so a
 * given debate is finalized at most once even if the producing transition fires
 * more than once.
 */
@Injectable()
export class DebateJobsProducer implements OnModuleDestroy {
    constructor(
        @Inject(FINALIZATION_QUEUE)
        private readonly finalizationQueue: Queue<FinalizationJob>,
    ) {}

    async enqueueFinalization(debateId: string): Promise<void> {
        await this.finalizationQueue.add(
            QUEUE_NAMES.FINALIZATION,
            { debateId, closedAt: Date.now() },
            {
                ...DEFAULT_JOB_OPTIONS,
                delay: FINALIZATION_DELAY_MS,
                jobId: `finalize:${debateId}`,
            },
        );
    }

    async onModuleDestroy(): Promise<void> {
        await this.finalizationQueue.close();
    }
}
