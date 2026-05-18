import { Injectable, Logger } from '@nestjs/common';
import { ReplayAnalysisJob } from '@repo/queue';
import { DebateMessage, DebateRepository, Side } from './debate.repository';
import { OpenRouterAnalysis, OpenRouterClient } from './openrouter.client';
import { computeLocalMetrics, groupBySide, LocalMetrics } from './metrics';

@Injectable()
export class ReplayAnalysisService {
    private readonly logger = new Logger(ReplayAnalysisService.name);

    constructor(
        private readonly debates: DebateRepository,
        private readonly openrouter: OpenRouterClient,
    ) {}

    async analyze(job: ReplayAnalysisJob): Promise<void> {
        const messages = await this.debates.getMessages(job.debateId);
        if (messages.length === 0) {
            this.logger.warn(`no messages for debateId=${job.debateId}, skipping`);
            return;
        }

        const bySide = groupBySide(messages);
        const metrics: Record<Side, LocalMetrics> = {
            POUR: computeLocalMetrics(bySide.POUR),
            CONTRE: computeLocalMetrics(bySide.CONTRE),
        };

        const analysis = await this.openrouter.analyze({
            debateId: job.debateId,
            messages,
            metrics,
        });

        await this.debates.persistAnalysis(job.debateId, {
            metrics,
            scores: analysis.scores,
            summary: analysis.summary,
            perPlayerFeedback: analysis.perPlayerFeedback,
        });

        await this.debates.emitAnalysisComplete({
            debateId: job.debateId,
            roomId: job.roomId,
        });
    }
}

// Re-export so other modules in this service can import via the service entry point if useful.
export type { LocalMetrics };
export type { DebateMessage, Side };
export type { OpenRouterAnalysis };
