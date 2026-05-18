import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
    DEFAULT_JOB_OPTIONS,
    QUEUE_NAMES,
    ROOM_CLEANUP_REPEAT,
    RoomCleanupJob,
} from '@repo/queue';

const REPEAT_JOB_NAME = 'room-cleanup-tick';

@Injectable()
export class CleanupScheduler {
    private readonly logger = new Logger(CleanupScheduler.name);

    constructor(@InjectQueue(QUEUE_NAMES.ROOM_CLEANUP) private readonly queue: Queue) {}

    async schedule(): Promise<void> {
        await this.queue.upsertJobScheduler(
            REPEAT_JOB_NAME,
            { pattern: ROOM_CLEANUP_REPEAT.pattern },
            {
                name: REPEAT_JOB_NAME,
                data: { scheduledAt: Date.now() } satisfies RoomCleanupJob,
                opts: DEFAULT_JOB_OPTIONS,
            },
        );
        this.logger.log(`scheduled cleanup with pattern=${ROOM_CLEANUP_REPEAT.pattern}`);
    }
}
