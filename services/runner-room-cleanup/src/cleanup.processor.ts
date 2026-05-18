import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_NAMES, RoomCleanupJob } from '@repo/queue';
import { CleanupService } from './cleanup.service';

@Processor(QUEUE_NAMES.ROOM_CLEANUP)
export class CleanupProcessor extends WorkerHost {
    private readonly logger = new Logger(CleanupProcessor.name);

    constructor(private readonly service: CleanupService) {
        super();
    }

    async process(_job: Job<RoomCleanupJob>): Promise<void> {
        const summary = await this.service.cleanup();
        this.logger.log(
            `cleanup tick: emptyDropped=${summary.emptyDropped} inactiveClosed=${summary.inactiveClosed} playersEvicted=${summary.playersEvicted} matchesCancelled=${summary.matchesCancelled}`,
        );
    }
}
