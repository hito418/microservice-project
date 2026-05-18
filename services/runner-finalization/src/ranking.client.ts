import { Injectable, Logger } from '@nestjs/common';
import { FinalScore } from './finalization.service';

/**
 * Stub: real implementation lands with #37/#38 (ranking service XP+Elo).
 */
@Injectable()
export class RankingClient {
    private readonly logger = new Logger(RankingClient.name);

    async updateForDebate(
        debateId: string,
        scores: FinalScore[],
        winnerId: string | null,
    ): Promise<void> {
        this.logger.debug(`updateForDebate(${debateId}, winner=${winnerId}) — stub`, scores);
    }
}
