import { sql } from 'drizzle-orm';
import { check, integer, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

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

// Player stats are written by the future ranking-service. They intentionally
// do not FK to auth.users (separate DB) or profiles (stats can exist before a
// display profile is created).
export const playerStats = pgTable(
    'player_stats',
    {
        userId: uuid('user_id').primaryKey(),
        xp: integer('xp').notNull().default(0),
        elo: integer('elo').notNull().default(1000),
        debatesCount: integer('debates_count').notNull().default(0),
        wins: integer('wins').notNull().default(0),
        losses: integer('losses').notNull().default(0),
        draws: integer('draws').notNull().default(0),
        createdAt: timestamp('created_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
        updatedAt: timestamp('updated_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
    },
    (table) => [
        check('player_stats_xp_check', sql`${table.xp} >= 0`),
        check('player_stats_elo_check', sql`${table.elo} >= 0`),
        check(
            'player_stats_debates_count_check',
            sql`${table.debatesCount} >= 0`,
        ),
        check('player_stats_wins_check', sql`${table.wins} >= 0`),
        check('player_stats_losses_check', sql`${table.losses} >= 0`),
        check('player_stats_draws_check', sql`${table.draws} >= 0`),
        check(
            'player_stats_counts_total_check',
            sql`${table.debatesCount} = ${table.wins} + ${table.losses} + ${table.draws}`,
        ),
    ],
);
