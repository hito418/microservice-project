import { z } from 'zod';

export const DEBATE_STATUSES = ['PENDING', 'RUNNING', 'VOTING', 'CLOSED'] as const;
export type DebateStatus = (typeof DEBATE_STATUSES)[number];

/**
 * Runtime validation for the UpsertDebateRequest proto message. Adds the
 * constraints proto3 can't express (non-empty id, the status enum).
 *
 * The UpsertDebateRequest/DebateResponse TS types come from
 * `./generated/scoring` — they're the canonical proto-derived shapes.
 */
export const upsertDebateSchema = z
    .object({
        debateId: z.string().trim().min(1, 'debateId is required'),
        status: z.enum(DEBATE_STATUSES),
    })
    .strict();
