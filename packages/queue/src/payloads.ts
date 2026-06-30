export interface ReplayAnalysisJob {
    debateId: string;
    roomId: string;
    enqueuedAt: number;
}

export interface FinalizationJob {
    debateId: string;
    /**
     * Originating room, when a room-scoped producer enqueues the job. Omitted by
     * producers that only know the debate (e.g. scoring); the consumer keys on
     * debateId and does not require it.
     */
    roomId?: string;
    closedAt: number;
}

export interface RoomCleanupJob {
    scheduledAt: number;
}
