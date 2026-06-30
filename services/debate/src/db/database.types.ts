import type { Kyselify } from 'drizzle-orm/kysely';
import type { Selectable } from 'kysely';
import { messages, participants, questions, roomTransitions, rooms } from './schema';

export type QuestionsTable = Kyselify<typeof questions>;
export type RoomsTable = Kyselify<typeof rooms>;
export type ParticipantsTable = Kyselify<typeof participants>;
export type MessagesTable = Kyselify<typeof messages>;
export type RoomTransitionsTable = Kyselify<typeof roomTransitions>;

export interface Database {
    questions: QuestionsTable;
    rooms: RoomsTable;
    participants: ParticipantsTable;
    messages: MessagesTable;
    room_transitions: RoomTransitionsTable;
}

export type QuestionRow = Selectable<QuestionsTable>;
export type RoomRow = Selectable<RoomsTable>;
export type ParticipantRow = Selectable<ParticipantsTable>;
export type MessageRow = Selectable<MessagesTable>;
export type RoomTransitionRow = Selectable<RoomTransitionsTable>;
