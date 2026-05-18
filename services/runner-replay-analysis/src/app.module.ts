import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QUEUE_NAMES, redisConnectionFromEnv } from '@repo/queue';
import { ReplayAnalysisProcessor } from './replay-analysis.processor';
import { ReplayAnalysisService } from './replay-analysis.service';
import { DebateRepository } from './debate.repository';
import { OpenRouterClient } from './openrouter.client';

@Module({
    imports: [
        BullModule.forRoot({ connection: redisConnectionFromEnv() }),
        BullModule.registerQueue({ name: QUEUE_NAMES.REPLAY_ANALYSIS }),
    ],
    providers: [
        ReplayAnalysisProcessor,
        ReplayAnalysisService,
        DebateRepository,
        OpenRouterClient,
    ],
})
export class AppModule {}
