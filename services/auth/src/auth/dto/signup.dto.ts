import { z } from 'zod';

export const signupSchema = z
    .object({
        email: z.string().trim().email().max(254),
        password: z.string().min(8).max(128),
    })
    .strict();

export type SignupDto = z.infer<typeof signupSchema>;
