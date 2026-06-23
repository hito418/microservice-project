import type { Kyselify } from 'drizzle-orm/kysely';
import type { Selectable } from 'kysely';
import { participants, questions, roomTransitions, rooms } from './schema';

export type QuestionsTable = Kyselify<typeof questions>;
export type RoomsTable = Kyselify<typeof rooms>;
export type ParticipantsTable = Kyselify<typeof participants>;
export type RoomTransitionsTable = Kyselify<typeof roomTransitions>;

export interface Database {
    questions: QuestionsTable;
    rooms: RoomsTable;
    participants: ParticipantsTable;
    room_transitions: RoomTransitionsTable;
}

export type QuestionRow = Selectable<QuestionsTable>;
export type RoomRow = Selectable<RoomsTable>;
export type ParticipantRow = Selectable<ParticipantsTable>;
export type RoomTransitionRow = Selectable<RoomTransitionsTable>;
