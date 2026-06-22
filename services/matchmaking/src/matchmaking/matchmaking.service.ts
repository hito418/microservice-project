import { Injectable } from '@nestjs/common';
import type { CancelMatchmakingResponse, MatchResponse } from '@contracts/matchmaking';

@Injectable()
export class MatchmakingService {
    async launchDebate(userId: string): Promise<MatchResponse> {
        return notInQueue(userId);
    }

    async getMatchStatus(userId: string): Promise<MatchResponse> {
        return notInQueue(userId);
    }

    async cancelMatchmaking(userId: string): Promise<CancelMatchmakingResponse> {
        void userId;
        return { cancelled: false };
    }
}

function notInQueue(userId: string): MatchResponse {
    return { userId, status: 'NOT_IN_QUEUE', debateRoomId: '', debateId: '', queuedAt: 0 };
}
