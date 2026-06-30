export interface ReplayAnalysisJob {
    debateId: string;
    roomId: string;
    enqueuedAt: number;
}

export interface FinalizationJob {
    debateId: string;
    closedAt: number;
}

export interface RoomCleanupJob {
    scheduledAt: number;
}
