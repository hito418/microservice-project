import { z } from 'zod';

export const FINAL_SCORE_WINNER_SIDES = ['FOR', 'AGAINST', 'DRAW'] as const;
export type FinalScoreWinnerSide = (typeof FINAL_SCORE_WINNER_SIDES)[number];

const scoreSchema = z.number().int().min(0).max(100);

export const computeFinalDebateScoreSchema = z
    .object({
        debateId: z.string().trim().min(1, 'debateId is required'),
    })
    .strict();

export const getFinalDebateScoreSchema = z
    .object({
        debateId: z.string().trim().min(1, 'debateId is required'),
    })
    .strict();

export const finalDebateScoreResponseSchema = z
    .object({
        debateId: z.string().trim().min(1),
        aiForScore: scoreSchema,
        aiAgainstScore: scoreSchema,
        audienceForScore: scoreSchema,
        audienceAgainstScore: scoreSchema,
        finalForScore: scoreSchema,
        finalAgainstScore: scoreSchema,
        winnerSide: z.enum(FINAL_SCORE_WINNER_SIDES),
        createdAt: z.string().trim().min(1),
        updatedAt: z.string().trim().min(1),
    })
    .strict();
