import { z } from 'zod';

export const DEFAULT_RANDOM_DEBATE_MAX_AGE_MINUTES = 20;
export const DEFAULT_RANDOM_DEBATE_CANDIDATE_POOL_SIZE = 5;

export const getRandomRecentDebateForVotingSchema = z
    .object({
        maxAgeMinutes: z
            .number()
            .int()
            .min(1)
            .max(1440)
            .optional()
            .default(DEFAULT_RANDOM_DEBATE_MAX_AGE_MINUTES),
        candidatePoolSize: z
            .number()
            .int()
            .min(1)
            .max(100)
            .optional()
            .default(DEFAULT_RANDOM_DEBATE_CANDIDATE_POOL_SIZE),
    })
    .strict();
