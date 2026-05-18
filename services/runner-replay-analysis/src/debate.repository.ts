import { Injectable, Logger } from '@nestjs/common';

export type Side = 'POUR' | 'CONTRE';

export interface DebateMessage {
    id: string;
    debateId: string;
    playerId: string;
    side: Side;
    content: string;
    sentAt: number;
}

export interface PersistedAnalysis {
    metrics: Record<Side, unknown>;
    scores: Record<string, number>;
    summary: string;
    perPlayerFeedback: Record<string, string>;
}

export interface AnalysisCompleteEvent {
    debateId: string;
    roomId: string;
}

/**
 * Stub: real implementation lands with #58 (Postgres schemas) and the
 * debate-service repositories. The runner depends on these interfaces, not
 * on a specific data store.
 */
@Injectable()
export class DebateRepository {
    private readonly logger = new Logger(DebateRepository.name);

    async getMessages(debateId: string): Promise<DebateMessage[]> {
        this.logger.debug(`getMessages(${debateId}) — stub`);
        return [];
    }

    async persistAnalysis(debateId: string, analysis: PersistedAnalysis): Promise<void> {
        this.logger.debug(`persistAnalysis(${debateId}) — stub`, analysis);
    }

    async emitAnalysisComplete(event: AnalysisCompleteEvent): Promise<void> {
        this.logger.debug('emitAnalysisComplete — stub', event);
    }
}
