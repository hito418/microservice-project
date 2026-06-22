import { pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

// One profile per user (1:1). `user_id` is the user's id as minted by the
// auth service (uuid) and doubles as this table's primary key — there is no
// cross-service foreign key since users live in a separate database.
export const profiles = pgTable('profiles', {
    userId: uuid('user_id').primaryKey(),
    displayName: varchar('display_name', { length: 255 }).notNull(),
    avatarUrl: varchar('avatar_url', { length: 2048 }),
    createdAt: timestamp('created_at', { withTimezone: true })
        .notNull()
        .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
        .notNull()
        .defaultNow(),
});
