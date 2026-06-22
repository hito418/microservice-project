import { z } from 'zod';

export const sendMessageSchema = z
    .object({
        roomId: z.string().trim().min(1, 'roomId is required'),
        content: z.string().trim().min(1, 'content is required'),
    })
    .strict();
