import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QUEUE_NAMES, redisConnectionFromEnv } from '@repo/queue';
import { CleanupProcessor } from './cleanup.processor';
import { CleanupScheduler } from './cleanup.scheduler';
import { CleanupService } from './cleanup.service';
import { RoomRepository } from './room.repository';

@Module({
    imports: [
        BullModule.forRoot({ connection: redisConnectionFromEnv() }),
        BullModule.registerQueue({ name: QUEUE_NAMES.ROOM_CLEANUP }),
    ],
    providers: [CleanupProcessor, CleanupScheduler, CleanupService, RoomRepository],
})
export class AppModule {}
