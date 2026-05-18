import { Injectable, Logger } from '@nestjs/common';
import { FinalScore } from './finalization.service';

/**
 * Stub: real implementation lands with #18 (profile XP/Elo/winrate stats).
 */
@Injectable()
export class ProfileClient {
    private readonly logger = new Logger(ProfileClient.name);

    async updateStats(
        debateId: string,
        scores: FinalScore[],
        winnerId: string | null,
    ): Promise<void> {
        this.logger.debug(`updateStats(${debateId}, winner=${winnerId}) — stub`, scores);
    }
}
