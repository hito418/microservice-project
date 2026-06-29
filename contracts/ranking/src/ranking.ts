import { z } from 'zod';

export const PERFORMANCE_SIDES = ['FOR', 'AGAINST'] as const;
export type PerformanceSide = (typeof PERFORMANCE_SIDES)[number];

export const PERFORMANCE_RESULTS = ['WIN', 'LOSS', 'DRAW'] as const;
export type PerformanceResult = (typeof PERFORMANCE_RESULTS)[number];

const userIdSchema = z.string().trim().uuid('userId must be a valid UUID');
const debateIdSchema = z.string().trim().min(1, 'debateId is required');
const scoreSchema = z.number().int().min(0).max(100);
const deltaSchema = z.number().int();

export const recordPerformanceSchema = z
    .object({
        userId: userIdSchema,
        debateId: debateIdSchema,
        side: z.enum(PERFORMANCE_SIDES),
        result: z.enum(PERFORMANCE_RESULTS),
        finalScore: scoreSchema,
        opponentScore: scoreSchema.optional(),
        xpDelta: deltaSchema.default(0),
        eloDelta: deltaSchema.default(0),
    })
    .strict();

export const listUserPerformanceHistorySchema = z
    .object({
        userId: userIdSchema,
        limit: z.number().int().min(1).max(100).default(20),
        offset: z.number().int().min(0).default(0),
    })
    .strict();
