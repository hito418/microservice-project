import { z } from 'zod';

export const AI_ANALYSIS_STATUSES = ['COMPLETED', 'FAILED'] as const;
export type AiAnalysisStatus = (typeof AI_ANALYSIS_STATUSES)[number];

const scoreSchema = z.number().int().min(0).max(100);
const requiredText = z.string().trim().min(1);

/**
 * Runtime validation for AI analysis result proto messages. Adds the
 * conditional rules proto3 can't express (COMPLETED requires scores and
 * feedback; FAILED requires an error message).
 */
export const storeAiAnalysisResultSchema = z
    .discriminatedUnion('status', [
        z
            .object({
                debateId: z.string().trim().min(1, 'debateId is required'),
                status: z.literal('COMPLETED'),
                summary: requiredText,
                forScore: scoreSchema,
                againstScore: scoreSchema,
                forFeedback: requiredText,
                againstFeedback: requiredText,
                errorMessage: z.string().trim().optional(),
            })
            .strict(),
        z
            .object({
                debateId: z.string().trim().min(1, 'debateId is required'),
                status: z.literal('FAILED'),
                summary: z.string().trim().optional(),
                forScore: scoreSchema.optional(),
                againstScore: scoreSchema.optional(),
                forFeedback: z.string().trim().optional(),
                againstFeedback: z.string().trim().optional(),
                errorMessage: requiredText,
            })
            .strict(),
    ]);

export const getAiAnalysisResultSchema = z
    .object({
        debateId: z.string().trim().min(1, 'debateId is required'),
    })
    .strict();
