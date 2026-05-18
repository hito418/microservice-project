import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_NAMES, ReplayAnalysisJob } from '@repo/queue';
import { ReplayAnalysisService } from './replay-analysis.service';

@Processor(QUEUE_NAMES.REPLAY_ANALYSIS)
export class ReplayAnalysisProcessor extends WorkerHost {
    private readonly logger = new Logger(ReplayAnalysisProcessor.name);

    constructor(private readonly service: ReplayAnalysisService) {
        super();
    }

    async process(job: Job<ReplayAnalysisJob>): Promise<void> {
        const { debateId } = job.data;
        this.logger.log(`analyzing replay debateId=${debateId} attempt=${job.attemptsMade + 1}`);
        await this.service.analyze(job.data);
        this.logger.log(`replay analysis complete debateId=${debateId}`);
    }
}
