import { pgTable, timestamp, unique, uuid, varchar } from 'drizzle-orm/pg-core';

// `status` / `side` are plain varchar: their allowed values are validated at
// the gRPC boundary by the @contracts/scoring zod schemas (the only write path),
// matching the proto-carries-strings design.

export const debates = pgTable('debates', {
    id: varchar('id', { length: 255 }).primaryKey(),
    status: varchar('status', { length: 32 }).notNull(),
});

export const spectatorVotes = pgTable(
    'spectator_votes',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        debateId: varchar('debate_id', { length: 255 })
            .notNull()
            .references(() => debates.id),
        userId: varchar('user_id', { length: 255 }).notNull(),
        side: varchar('side', { length: 16 }).notNull(),
        createdAt: timestamp('created_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
    },
    (table) => [
        unique('spectator_votes_debate_user_unique').on(
            table.debateId,
            table.userId,
        ),
    ],
);
