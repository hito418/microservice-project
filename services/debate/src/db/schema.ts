import { pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

export const rooms = pgTable('rooms', {
    id: uuid('id').primaryKey().defaultRandom(),
    debateId: varchar('debate_id', { length: 255 }).notNull(),
    state: varchar('state', { length: 32 }).notNull().default('PREPARATION'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const roomTransitions = pgTable('room_transitions', {
    id: uuid('id').primaryKey().defaultRandom(),
    roomId: uuid('room_id')
        .notNull()
        .references(() => rooms.id, { onDelete: 'cascade' }),
    fromState: varchar('from_state', { length: 32 }).notNull(),
    toState: varchar('to_state', { length: 32 }).notNull(),
    transitionedAt: timestamp('transitioned_at', { withTimezone: true }).notNull().defaultNow(),
});
