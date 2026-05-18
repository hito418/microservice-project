import { Injectable, Logger } from '@nestjs/common';
import { FinalScore } from './finalization.service';

/**
 * Stub: real implementation lands with #58 (Postgres) + #34/#33 (scoring service).
 */
@Injectable()
export class DebateRepository {
    private readonly logger = new Logger(DebateRepository.name);

    async getAiScores(debateId: string): Promise<Record<string, number>> {
        this.logger.debug(`getAiScores(${debateId}) — stub`);
        return {};
    }

    async getAudienceScores(debateId: string): Promise<Record<string, number>> {
        this.logger.debug(`getAudienceScores(${debateId}) — stub`);
        return {};
    }

    async markClosed(
        debateId: string,
        winnerId: string | null,
        scores: FinalScore[],
    ): Promise<void> {
        this.logger.debug(`markClosed(${debateId}, winner=${winnerId}) — stub`, scores);
    }
}
