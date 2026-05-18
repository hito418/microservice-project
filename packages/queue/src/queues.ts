export const QUEUE_NAMES = {
    REPLAY_ANALYSIS: 'debate.analyze-replay',
    FINALIZATION: 'debate.finalize',
    ROOM_CLEANUP: 'room.cleanup',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

export const DEFAULT_JOB_OPTIONS = {
    attempts: 3,
    backoff: { type: 'exponential' as const, delay: 5_000 },
    removeOnComplete: { age: 24 * 3600, count: 1000 },
    removeOnFail: { age: 7 * 24 * 3600 },
};

export const FINALIZATION_DELAY_MS = 20 * 60 * 1000;

export const ROOM_CLEANUP_REPEAT = {
    pattern: '*/5 * * * *',
} as const;
