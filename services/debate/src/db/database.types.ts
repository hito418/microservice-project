import type { Kyselify } from 'drizzle-orm/kysely';
import type { Selectable } from 'kysely';
import { questions, roomTransitions, rooms } from './schema';

export type QuestionsTable = Kyselify<typeof questions>;
export type RoomsTable = Kyselify<typeof rooms>;
export type RoomTransitionsTable = Kyselify<typeof roomTransitions>;

export interface Database {
    questions: QuestionsTable;
    rooms: RoomsTable;
    room_transitions: RoomTransitionsTable;
}

export type QuestionRow = Selectable<QuestionsTable>;
export type RoomRow = Selectable<RoomsTable>;
export type RoomTransitionRow = Selectable<RoomTransitionsTable>;
