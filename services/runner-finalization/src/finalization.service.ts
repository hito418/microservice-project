import { Injectable, Logger } from '@nestjs/common';
import { FinalizationJob } from '@repo/queue';
import { DebateRepository } from './debate.repository';
import { RankingClient } from './ranking.client';
import { ProfileClient } from './profile.client';
import { NotificationClient } from './notification.client';

export interface FinalScore {
    playerId: string;
    aiScore: number;
    audienceScore: number;
    total: number;
}

@Injectable()
export class FinalizationService {
    private readonly logger = new Logger(FinalizationService.name);

    constructor(
        private readonly debates: DebateRepository,
        private readonly ranking: RankingClient,
        private readonly profile: ProfileClient,
        private readonly notifications: NotificationClient,
    ) {}

    async finalize(job: FinalizationJob): Promise<void> {
        const ai = await this.debates.getAiScores(job.debateId);
        const audience = await this.debates.getAudienceScores(job.debateId);

        const players = new Set([...Object.keys(ai), ...Object.keys(audience)]);
        if (players.size === 0) {
            this.logger.warn(`no scores for debateId=${job.debateId}, marking closed anyway`);
            await this.debates.markClosed(job.debateId, null, []);
            return;
        }

        const scores: FinalScore[] = [...players].map((playerId) => ({
            playerId,
            aiScore: ai[playerId] ?? 0,
            audienceScore: audience[playerId] ?? 0,
            total: (ai[playerId] ?? 0) + (audience[playerId] ?? 0),
        }));

        const winner = pickWinner(scores);

        await this.ranking.updateForDebate(job.debateId, scores, winner);
        await this.profile.updateStats(job.debateId, scores, winner);
        await this.debates.markClosed(job.debateId, winner, scores);
        await this.notifications.notifyResult({
            debateId: job.debateId,
            roomId: job.roomId,
            scores,
            winner,
        });
    }
}

function pickWinner(scores: FinalScore[]): string | null {
    if (scores.length === 0) return null;
    const sorted = [...scores].sort((a, b) => b.total - a.total);
    if (sorted.length > 1 && sorted[0].total === sorted[1].total) return null;
    return sorted[0].playerId;
}
