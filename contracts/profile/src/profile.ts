import { z } from 'zod';

export const DISPLAY_NAME_MAX_LENGTH = 255;
export const AVATAR_URL_MAX_LENGTH = 2048;

const displayNameSchema = z
    .string()
    .trim()
    .min(1, 'displayName is required')
    .max(DISPLAY_NAME_MAX_LENGTH);

const avatarUrlSchema = z.string().trim().url().max(AVATAR_URL_MAX_LENGTH);

const userIdSchema = z.string().trim().uuid('userId must be a valid UUID');

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
