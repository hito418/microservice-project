import { Inject, Injectable, type OnApplicationShutdown } from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS } from './redis.module';

const QUEUE_KEY = 'matchmaking:queue';
const PLAYER_KEY = (userId: string) => `matchmaking:player:${userId}`;

export type MatchStatus = 'WAITING' | 'MATCHED' | 'CANCELLED' | 'NOT_IN_QUEUE';

export interface PlayerState {
    userId: string;
    status: MatchStatus;
    debateRoomId: string;
    debateId: string;
    queuedAt: number;
}

export interface EnqueueResult {
    state: PlayerState;
    /** Set only when status is MATCHED — the other player's userId */
    opponentId?: string;
    opponentQueuedAt?: number;
}

@Injectable()
export class MatchmakingRepository implements OnApplicationShutdown {
    constructor(@Inject(REDIS) private readonly redis: Redis) {}

    async enqueue(userId: string): Promise<EnqueueResult> {
        const now = Date.now();

        const existing = await this.getPlayerState(userId);
        if (existing) return { state: existing };

        // Atomically pop the oldest waiting player from the queue.
        const popped = await this.redis.zpopmin(QUEUE_KEY, 1);

        if (popped.length >= 2) {
            const opponentId = popped[0];
            const opponentQueuedAt = Number(popped[1]);

            const waitingState: PlayerState = {
                userId,
                status: 'MATCHED',
                debateRoomId: '',
                debateId: '',
                queuedAt: now,
            };
            await this.setPlayerState(userId, waitingState);
            // Opponent state will be updated with room details once debate room is created.
            return { state: waitingState, opponentId, opponentQueuedAt };
        }

        const waitingState: PlayerState = {
            userId,
            status: 'WAITING',
            debateRoomId: '',
            debateId: '',
            queuedAt: now,
        };
        await Promise.all([
            this.redis.zadd(QUEUE_KEY, now, userId),
            this.setPlayerState(userId, waitingState),
        ]);
        return { state: waitingState };
    }

    async getPlayerState(userId: string): Promise<PlayerState | null> {
        const raw = await this.redis.get(PLAYER_KEY(userId));
        if (!raw) return null;
        return JSON.parse(raw) as PlayerState;
    }

    async setPlayerState(userId: string, state: PlayerState, ttlSeconds = 300): Promise<void> {
        await this.redis.setex(PLAYER_KEY(userId), ttlSeconds, JSON.stringify(state));
    }

    async removeFromQueue(userId: string): Promise<boolean> {
        const [removed] = await Promise.all([
            this.redis.zrem(QUEUE_KEY, userId),
            this.redis.del(PLAYER_KEY(userId)),
        ]);
        return removed > 0;
    }

    async onApplicationShutdown(): Promise<void> {
        await this.redis.quit();
    }
}
