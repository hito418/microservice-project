import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QUEUE_NAMES, redisConnectionFromEnv } from '@repo/queue';
import { FinalizationProcessor } from './finalization.processor';
import { FinalizationService } from './finalization.service';
import { DebateRepository } from './debate.repository';
import { RankingClient } from './ranking.client';
import { ProfileClient } from './profile.client';
import { NotificationClient } from './notification.client';

@Module({
    imports: [
        BullModule.forRoot({ connection: redisConnectionFromEnv() }),
        BullModule.registerQueue({ name: QUEUE_NAMES.FINALIZATION }),
    ],
    providers: [
        FinalizationProcessor,
        FinalizationService,
        DebateRepository,
        RankingClient,
        ProfileClient,
        NotificationClient,
    ],
})
export class AppModule {}
