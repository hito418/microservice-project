import { Inject, Injectable, Logger, type OnApplicationShutdown, type OnModuleInit } from '@nestjs/common';
import { Worker } from 'bullmq';
import { redisConnectionFromEnv } from '@repo/queue';
import { MatchmakingRepository } from './matchmaking.repository';

const QUEUE_NAME = 'matchmaking.timeout';

export interface MatchmakingTimeoutJob {
    userId: string;
    queuedAt: number;
}

@Injectable()
export class MatchmakingTimeoutWorker implements OnModuleInit, OnApplicationShutdown {
    private readonly logger = new Logger(MatchmakingTimeoutWorker.name);
    private worker!: Worker<MatchmakingTimeoutJob>;

    constructor(@Inject(MatchmakingRepository) private readonly repo: MatchmakingRepository) {}

    onModuleInit(): void {
        this.worker = new Worker<MatchmakingTimeoutJob>(
            QUEUE_NAME,
            async (job) => {
                const { userId, queuedAt } = job.data;
                const state = await this.repo.getPlayerState(userId);

                if (!state || state.status !== 'WAITING' || state.queuedAt !== queuedAt) {
                    // Player was already matched or manually cancelled.
                    return;
                }

                await this.repo.removeFromQueue(userId);
                this.logger.log(`Player ${userId} timed out — removed from matchmaking queue`);
            },
            { connection: redisConnectionFromEnv() },
        );

        this.worker.on('failed', (job, err) => {
            this.logger.error(`Timeout job ${job?.id} failed`, err);
        });
    }

    async onApplicationShutdown(): Promise<void> {
        await this.worker.close();
    }
}

export { QUEUE_NAME as MATCHMAKING_TIMEOUT_QUEUE };
