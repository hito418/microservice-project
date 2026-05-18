import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { FinalizationJob, QUEUE_NAMES } from '@repo/queue';
import { FinalizationService } from './finalization.service';

@Processor(QUEUE_NAMES.FINALIZATION)
export class FinalizationProcessor extends WorkerHost {
    private readonly logger = new Logger(FinalizationProcessor.name);

    constructor(private readonly service: FinalizationService) {
        super();
    }

    async process(job: Job<FinalizationJob>): Promise<void> {
        const { debateId } = job.data;
        this.logger.log(`finalizing debateId=${debateId} attempt=${job.attemptsMade + 1}`);
        await this.service.finalize(job.data);
        this.logger.log(`finalized debateId=${debateId}`);
    }
}
