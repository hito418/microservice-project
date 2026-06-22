import { z } from 'zod';

/**
 * Runtime validation for the AudienceVoteSummaryRequest proto message.
 *
 * The AudienceVoteSummaryRequest/AudienceVoteSummaryResponse TS types come
 * from `./generated/scoring`.
 */
export const audienceVoteSummarySchema = z
    .object({
        debateId: z.string().trim().min(1, 'debateId is required'),
    })
    .strict();
