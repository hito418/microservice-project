import { z } from 'zod';

export const SPECTATOR_VOTE_SIDES = ['FOR', 'AGAINST'] as const;
export type SpectatorVoteSide = (typeof SPECTATOR_VOTE_SIDES)[number];

/**
 * Runtime validation for the CreateSpectatorVoteRequest proto message. Adds the
 * constraints proto3 can't express (non-empty ids, the side enum).
 *
 * The CreateSpectatorVoteRequest/SpectatorVoteResponse TS types come from
 * `./generated/scoring` — they're the canonical proto-derived shapes.
 */
export const createSpectatorVoteSchema = z
    .object({
        debateId: z.string().trim().min(1, 'debateId is required'),
        side: z.enum(SPECTATOR_VOTE_SIDES),
    })
    .strict();
