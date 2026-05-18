import { Injectable } from '@nestjs/common';
import { RoomRepository } from './room.repository';

const INACTIVITY_THRESHOLD_MS = 10 * 60 * 1000;
const DISCONNECT_GRACE_MS = 60 * 1000;
const MATCH_START_GRACE_MS = 5 * 60 * 1000;

export interface CleanupSummary {
    emptyDropped: number;
    inactiveClosed: number;
    playersEvicted: number;
    matchesCancelled: number;
}

@Injectable()
export class CleanupService {
    constructor(private readonly rooms: RoomRepository) {}

    async cleanup(): Promise<CleanupSummary> {
        const now = Date.now();
        const emptyDropped = await this.rooms.dropEmptyRooms();
        const inactiveClosed = await this.rooms.closeInactiveRooms(
            now - INACTIVITY_THRESHOLD_MS,
        );
        const playersEvicted = await this.rooms.evictDisconnectedPlayers(
            now - DISCONNECT_GRACE_MS,
        );
        const matchesCancelled = await this.rooms.cancelNonStartedMatches(
            now - MATCH_START_GRACE_MS,
        );
        return { emptyDropped, inactiveClosed, playersEvicted, matchesCancelled };
    }
}
