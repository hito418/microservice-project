import { Injectable, Logger } from '@nestjs/common';
import { DebateMessage, Side } from './debate.repository';
import { LocalMetrics } from './metrics';

export interface OpenRouterAnalysisRequest {
    debateId: string;
    messages: DebateMessage[];
    metrics: Record<Side, LocalMetrics>;
}

export interface OpenRouterAnalysis {
    scores: Record<string, number>;
    summary: string;
    perPlayerFeedback: Record<string, string>;
}

/**
 * Stub: real implementation lands with #62 (OpenRouter wrapper) and #63
 * (prompt template). Until then this returns deterministic placeholder
 * scores so the rest of the pipeline can be exercised end-to-end.
 */
@Injectable()
export class OpenRouterClient {
    private readonly logger = new Logger(OpenRouterClient.name);

    async analyze(req: OpenRouterAnalysisRequest): Promise<OpenRouterAnalysis> {
        this.logger.debug(`analyze(${req.debateId}) — stub`);
        const players = new Set(req.messages.map((m) => m.playerId));
        const scores: Record<string, number> = {};
        const perPlayerFeedback: Record<string, string> = {};
        for (const p of players) {
            scores[p] = 0;
            perPlayerFeedback[p] = 'pending';
        }
        return { scores, summary: 'pending', perPlayerFeedback };
    }
}
