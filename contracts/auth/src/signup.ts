import { z } from 'zod';

/**
 * Runtime validation for the SignupRequest proto message. Adds the
 * constraints proto3 can't express (email format, length bounds).
 *
 * The SignupRequest/SignupResponse TS types come from `./generated/auth`
 * — they're the canonical proto-derived shapes.
 */
export const signupSchema = z
    .object({
        email: z.string().trim().email().max(254),
        password: z.string().min(8).max(128),
    })
    .strict();
