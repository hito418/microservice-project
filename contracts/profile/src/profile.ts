import { z } from 'zod';

export const DISPLAY_NAME_MAX_LENGTH = 255;
export const AVATAR_URL_MAX_LENGTH = 2048;
export const PLAYER_STATS_RESULTS = ['WIN', 'LOSS', 'DRAW'] as const;
export type PlayerStatsResult = (typeof PLAYER_STATS_RESULTS)[number];
export const RANK_TIERS = [
    'BRONZE',
    'SILVER',
    'GOLD',
    'PLATINUM',
    'DIAMOND',
    'MASTER',
] as const;
export type RankTier = (typeof RANK_TIERS)[number];

const displayNameSchema = z
    .string()
    .trim()
    .min(1, 'displayName is required')
    .max(DISPLAY_NAME_MAX_LENGTH);

const avatarUrlSchema = z.string().trim().url().max(AVATAR_URL_MAX_LENGTH);

const userIdSchema = z.string().trim().uuid('userId must be a valid UUID');
const nonNegativeIntegerSchema = z.number().int().min(0);

const statsCountsSchema = z
    .object({
        debatesCount: nonNegativeIntegerSchema,
        wins: nonNegativeIntegerSchema,
        losses: nonNegativeIntegerSchema,
        draws: nonNegativeIntegerSchema,
    })
    .refine(
        (value) => value.debatesCount === value.wins + value.losses + value.draws,
        {
            message: 'debatesCount must equal wins + losses + draws',
            path: ['debatesCount'],
        },
    );

/**
 * Runtime validation for the profile proto messages. Adds the constraints
 * proto3 can't express (non-empty display name, URL shape, length bounds).
 *
 * The request/response TS types come from `./generated/profile` — they're the
 * canonical proto-derived shapes.
 */
export const createProfileSchema = z
    .object({
        displayName: displayNameSchema,
        avatarUrl: avatarUrlSchema.optional(),
    })
    .strict();

export const getProfileSchema = z
    .object({
        userId: userIdSchema,
    })
    .strict();

/**
 * Partial update of the caller's own profile. Absent fields are left
 * unchanged; an empty `avatarUrl` clears the stored value. At least one
 * field must be provided.
 */
export const updateProfileSchema = z
    .object({
        displayName: displayNameSchema.optional(),
        avatarUrl: z.union([z.literal(''), avatarUrlSchema]).optional(),
    })
    .strict()
    .refine(
        (value) =>
            value.displayName !== undefined || value.avatarUrl !== undefined,
        { message: 'At least one of displayName or avatarUrl must be provided' },
    );

export const deleteProfileSchema = z.object({}).strict();

export const getPlayerStatsSchema = z
    .object({
        userId: userIdSchema,
    })
    .strict();

export const upsertPlayerStatsSchema = z
    .object({
        userId: userIdSchema,
        xp: nonNegativeIntegerSchema,
        elo: nonNegativeIntegerSchema,
        debatesCount: nonNegativeIntegerSchema,
        wins: nonNegativeIntegerSchema,
        losses: nonNegativeIntegerSchema,
        draws: nonNegativeIntegerSchema,
    })
    .strict()
    .and(statsCountsSchema);

export const applyPlayerStatsDeltaSchema = z
    .object({
        userId: userIdSchema,
        xpDelta: nonNegativeIntegerSchema,
        eloDelta: z.number().int(),
        result: z.enum(PLAYER_STATS_RESULTS),
    })
    .strict();
