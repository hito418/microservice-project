import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import type { CancelMatchmakingResponse, MatchResponse } from '@contracts/matchmaking';
import { Metadata } from '@grpc/grpc-js';
import { type ClientGrpc } from '@nestjs/microservices';
import { Queue } from 'bullmq';
import { randomUUID } from 'node:crypto';
import { redisConnectionFromEnv } from '@repo/queue';
import { firstValueFrom } from 'rxjs';
import { DEBATE_CLIENT } from '../debate/debate.module';
import { DEBATE_SERVICE_NAME, type DebateServiceClient } from '../debate/debate-client.types';
import { MATCHMAKING_TIMEOUT_QUEUE, type MatchmakingTimeoutJob } from './matchmaking-timeout.worker';
import type { PlayerState } from './matchmaking.repository';
import { MatchmakingRepository } from './matchmaking.repository';

const QUEUE_TIMEOUT_MS = 60_000;

@Injectable()
export class MatchmakingService implements OnModuleInit {
    private readonly logger = new Logger(MatchmakingService.name);
    private debateService!: DebateServiceClient;
    private readonly timeoutQueue = new Queue<MatchmakingTimeoutJob>(MATCHMAKING_TIMEOUT_QUEUE, {
        connection: redisConnectionFromEnv(),
    });

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
            // Cancel any pending timeout for the opponent who was just matched.
            await this.timeoutQueue.remove(result.opponentId).catch(() => null);
            return this.triggerDebate(userId, result.opponentId, result.state.queuedAt);
        }

        // Schedule auto-cancel if no match within timeout.
        await this.timeoutQueue.add(
            'cancel',
            { userId, queuedAt: result.state.queuedAt },
            { delay: QUEUE_TIMEOUT_MS, jobId: userId },
        );

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
        await this.timeoutQueue.remove(userId).catch(() => null);
        const removed = await this.repo.removeFromQueue(userId);
        return { cancelled: removed };
    }

    private async triggerDebate(
        userId: string,
        opponentId: string,
        playerQueuedAt: number,
    ): Promise<MatchResponse> {
        const debateId = randomUUID();

        const room = await firstValueFrom(
            this.debateService.createRoom({ debateId }),
        );

        await Promise.all([
            firstValueFrom(this.debateService.joinRoom({ roomId: room.id }, userMetadata(userId))),
            firstValueFrom(this.debateService.joinRoom({ roomId: room.id }, userMetadata(opponentId))),
        ]);

        this.logger.log(
            `Matched ${userId} vs ${opponentId} → debate room ${room.id} (debate ${debateId})`,
        );

        const opponentQueuedAt = (await this.repo.getPlayerState(opponentId))?.queuedAt ?? Date.now();

        const makeState = (uid: string, queuedAt: number): PlayerState => ({
            userId: uid,
            status: 'MATCHED',
            debateRoomId: room.id,
            debateId,
            queuedAt,
        });

        await Promise.all([
            this.repo.setPlayerState(userId, makeState(userId, playerQueuedAt)),
            this.repo.setPlayerState(opponentId, makeState(opponentId, opponentQueuedAt)),
        ]);

        return toMatchResponse(makeState(userId, playerQueuedAt));
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
