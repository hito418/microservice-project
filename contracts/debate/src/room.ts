import { z } from 'zod';

export const DEBATE_STATES = ['PREPARATION', 'RUNNING', 'VOTING', 'CLOSED'] as const;
export type DebateState = (typeof DEBATE_STATES)[number];

export const PARTICIPANT_SIDES = ['POUR', 'CONTRE'] as const;
export type ParticipantSide = (typeof PARTICIPANT_SIDES)[number];

export const createRoomSchema = z
    .object({ debateId: z.string().trim().min(1, 'debateId is required') })
    .strict();

export const getRoomSchema = z
    .object({ roomId: z.string().trim().min(1, 'roomId is required') })
    .strict();

export const transitionSchema = z
    .object({
        roomId: z.string().trim().min(1, 'roomId is required'),
        to: z.enum(DEBATE_STATES),
    })
    .strict();

export const joinRoomSchema = z
    .object({ roomId: z.string().trim().min(1, 'roomId is required') })
    .strict();

export const getReplaySchema = z
    .object({ roomId: z.string().trim().min(1, 'roomId is required') })
    .strict();
