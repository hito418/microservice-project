import { Injectable } from '@nestjs/common';
import type { CancelMatchmakingResponse, MatchResponse } from '@contracts/matchmaking';
import { MatchmakingRepository } from './matchmaking.repository';

@Injectable()
export class MatchmakingService {
    constructor(private readonly repo: MatchmakingRepository) {}

    async launchDebate(userId: string): Promise<MatchResponse> {
        const state = await this.repo.enqueue(userId);
        return toMatchResponse(state);
    }

    async getMatchStatus(userId: string): Promise<MatchResponse> {
        const state = await this.repo.getPlayerState(userId);
        if (!state) {
            return { userId, status: 'NOT_IN_QUEUE', debateRoomId: '', debateId: '', queuedAt: 0 };
        }
        return toMatchResponse(state);
    }

    async cancelMatchmaking(userId: string): Promise<CancelMatchmakingResponse> {
        const removed = await this.repo.removeFromQueue(userId);
        return { cancelled: removed };
    }
}

function toMatchResponse(state: {
    userId: string;
    status: string;
    debateRoomId: string;
    debateId: string;
    queuedAt: number;
}): MatchResponse {
    return {
        userId: state.userId,
        status: state.status,
        debateRoomId: state.debateRoomId,
        debateId: state.debateId,
        queuedAt: state.queuedAt,
    };
}
