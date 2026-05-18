import { Injectable, Logger } from '@nestjs/common';
import { FinalScore } from './finalization.service';

export interface ResultEvent {
    debateId: string;
    roomId: string;
    scores: FinalScore[];
    winner: string | null;
}

/**
 * Stub: real implementation lands with #44 (realtime result + leaderboard events).
 */
@Injectable()
export class NotificationClient {
    private readonly logger = new Logger(NotificationClient.name);

    async notifyResult(event: ResultEvent): Promise<void> {
        this.logger.debug('notifyResult — stub', event);
    }
}
