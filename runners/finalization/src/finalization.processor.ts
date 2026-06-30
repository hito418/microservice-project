import { Injectable, Logger } from '@nestjs/common';
import { type FinalizationJob } from '@repo/queue';
import { type JobProcessor } from '@repo/runner';
import type { Job } from 'bullmq';
import { ScoringClient } from './scoring-client.service';

/**
 * Consumes `debate.finalize` jobs: asks the scoring service to compute and
 * persist the final debate score. gRPC errors are logged and re-thrown so
 * BullMQ applies the queue's retry policy — note a NOT_FOUND/FAILED_PRECONDITION
 * here usually means the debate's AI analysis result has not been stored yet.
 */
@Injectable()
export class FinalizationProcessor implements JobProcessor<FinalizationJob> {
    private readonly logger = new Logger(FinalizationProcessor.name);

    constructor(private readonly scoring: ScoringClient) {}

    async process(job: Job<FinalizationJob>): Promise<void> {
        const { debateId } = job.data;
        this.logger.log(`Finalizing debate ${debateId} (job ${job.id})`);
        try {
            const result = await this.scoring.computeFinalDebateScore({ debateId });
            this.logger.log(
                `Debate ${debateId} finalized: winner=${result.winnerSide} ` +
                    `for=${result.finalForScore} against=${result.finalAgainstScore}`,
            );
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.warn(`Finalizing debate ${debateId} failed: ${message}`);
            throw error;
        }
    }
}
