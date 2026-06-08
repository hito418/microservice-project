import { z } from 'zod';

/**
 * Runtime validation for the LoginRequest proto message. Adds the
 * constraints proto3 can't express (email format, length bounds).
 *
 * The LoginRequest/LoginResponse TS types come from `./generated/auth`.
 */
export const loginSchema = z
    .object({
        email: z.string().trim().email().max(254),
        password: z.string().min(1).max(128),
    })
    .strict();

export const USER_ROLES = ['user', 'admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];
