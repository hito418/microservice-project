export interface ReplayAnalysisJob {
    debateId: string;
    roomId: string;
    enqueuedAt: number;
}

export interface FinalizationJob {
    debateId: string;
    roomId: string;
    closedAt: number;
}

export interface RoomCleanupJob {
    scheduledAt: number;
}
