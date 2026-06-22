import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import type { CancelMatchmakingResponse, MatchResponse } from '@contracts/matchmaking';
import { Metadata } from '@grpc/grpc-js';
import { type ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { randomUUID } from 'node:crypto';
import { DEBATE_CLIENT } from '../debate/debate.module';
import { DEBATE_SERVICE_NAME, type DebateServiceClient } from '../debate/debate-client.types';
import type { PlayerState } from './matchmaking.repository';
import { MatchmakingRepository } from './matchmaking.repository';

@Injectable()
export class MatchmakingService implements OnModuleInit {
    private readonly logger = new Logger(MatchmakingService.name);
    private debateService!: DebateServiceClient;

    constructor(
        private readonly repo: MatchmakingRepository,
        @Inject(DEBATE_CLIENT) private readonly debateClient: ClientGrpc,
    ) {}

    onModuleInit(): void {
        this.debateService = this.debateClient.getService<DebateServiceClient>(DEBATE_SERVICE_NAME);
    }

    async launchDebate(userId: string): Promise<MatchResponse> {
        const result = await this.repo.enqueue(userId);

        if (result.opponentId) {
            return this.triggerDebate(userId, result.opponentId, result.state.queuedAt);
        }

        return toMatchResponse(result.state);
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

    private async triggerDebate(
        userId: string,
        opponentId: string,
        playerQueuedAt: number,
    ): Promise<MatchResponse> {
        const debateId = randomUUID();

        try {
            const room = await firstValueFrom(
                this.debateService.createRoom({ debateId }),
            );

            // Join both players — debate service reads userId from gRPC metadata.
            const meta1 = userMetadata(userId);
            const meta2 = userMetadata(opponentId);
            await Promise.all([
                firstValueFrom(this.debateService.joinRoom({ roomId: room.id }, meta1)),
                firstValueFrom(this.debateService.joinRoom({ roomId: room.id }, meta2)),
            ]);

            this.logger.log(
                `Matched ${userId} vs ${opponentId} → debate room ${room.id} (debate ${debateId})`,
            );

            const matched = (userId: string, queuedAt: number): PlayerState => ({
                userId,
                status: 'MATCHED',
                debateRoomId: room.id,
                debateId,
                queuedAt,
            });

            const opponentQueuedAt = (await this.repo.getPlayerState(opponentId))?.queuedAt ?? Date.now();
            await Promise.all([
                this.repo.setPlayerState(userId, matched(userId, playerQueuedAt)),
                this.repo.setPlayerState(opponentId, matched(opponentId, opponentQueuedAt)),
            ]);

            return toMatchResponse(matched(userId, playerQueuedAt));
        } catch (err) {
            this.logger.error(`Failed to trigger debate for ${userId} vs ${opponentId}`, err);
            throw err;
        }
    }
}

function userMetadata(userId: string): Metadata {
    const meta = new Metadata();
    meta.set('x-user-id', userId);
    meta.set('x-user-role', 'user');
    return meta;
}

function toMatchResponse(state: PlayerState): MatchResponse {
    return {
        userId: state.userId,
        status: state.status,
        debateRoomId: state.debateRoomId,
        debateId: state.debateId,
        queuedAt: state.queuedAt,
    };
}
