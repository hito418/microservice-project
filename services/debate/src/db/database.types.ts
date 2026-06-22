import type { Kyselify } from 'drizzle-orm/kysely';
import type { Selectable } from 'kysely';
import { roomTransitions, rooms } from './schema';

export type RoomsTable = Kyselify<typeof rooms>;
export type RoomTransitionsTable = Kyselify<typeof roomTransitions>;

export interface Database {
    rooms: RoomsTable;
    room_transitions: RoomTransitionsTable;
}

export type RoomRow = Selectable<RoomsTable>;
export type RoomTransitionRow = Selectable<RoomTransitionsTable>;
