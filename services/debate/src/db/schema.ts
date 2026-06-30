import { pgTable, text, timestamp, unique, uuid, varchar } from 'drizzle-orm/pg-core';

export const questions = pgTable('questions', {
    id: uuid('id').primaryKey().defaultRandom(),
    content: text('content').notNull(),
});

export const rooms = pgTable('rooms', {
    id: uuid('id').primaryKey().defaultRandom(),
    debateId: varchar('debate_id', { length: 255 }).notNull(),
    state: varchar('state', { length: 32 }).notNull().default('PREPARATION'),
    questionId: uuid('question_id').references(() => questions.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const participants = pgTable(
    'participants',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        roomId: uuid('room_id')
            .notNull()
            .references(() => rooms.id, { onDelete: 'cascade' }),
        userId: varchar('user_id', { length: 255 }).notNull(),
        side: varchar('side', { length: 16 }).notNull(),
        joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
    },
    (table) => [
        unique('participants_room_user_unique').on(table.roomId, table.userId),
        unique('participants_room_side_unique').on(table.roomId, table.side),
    ],
);

export const messages = pgTable('messages', {
    id: uuid('id').primaryKey().defaultRandom(),
    roomId: uuid('room_id')
        .notNull()
        .references(() => rooms.id, { onDelete: 'cascade' }),
    userId: varchar('user_id', { length: 255 }).notNull(),
    content: text('content').notNull(),
    sentAt: timestamp('sent_at', { withTimezone: true }).notNull().defaultNow(),
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
