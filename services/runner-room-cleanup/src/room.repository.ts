import { Injectable, Logger } from '@nestjs/common';

/**
 * Stub: real implementation lands with #58 (Postgres) + matchmaking/debate
 * services. Each method returns the count of affected rows.
 */
@Injectable()
export class RoomRepository {
    private readonly logger = new Logger(RoomRepository.name);

    async dropEmptyRooms(): Promise<number> {
        this.logger.debug('dropEmptyRooms — stub');
        return 0;
    }

    async closeInactiveRooms(inactiveBefore: number): Promise<number> {
        this.logger.debug(`closeInactiveRooms(<${inactiveBefore}) — stub`);
        return 0;
    }

    async evictDisconnectedPlayers(disconnectedBefore: number): Promise<number> {
        this.logger.debug(`evictDisconnectedPlayers(<${disconnectedBefore}) — stub`);
        return 0;
    }

    async cancelNonStartedMatches(createdBefore: number): Promise<number> {
        this.logger.debug(`cancelNonStartedMatches(<${createdBefore}) — stub`);
        return 0;
    }
}
