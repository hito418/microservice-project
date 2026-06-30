import { sql } from 'drizzle-orm';
import {
    check,
    integer,
    pgTable,
    timestamp,
    unique,
    uuid,
    varchar,
} from 'drizzle-orm/pg-core';

export const rankingPerformances = pgTable(
    'ranking_performances',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        userId: uuid('user_id').notNull(),
        debateId: varchar('debate_id', { length: 255 }).notNull(),
        side: varchar('side', { length: 16 }).notNull(),
        result: varchar('result', { length: 16 }).notNull(),
        finalScore: integer('final_score').notNull(),
        opponentScore: integer('opponent_score'),
        xpDelta: integer('xp_delta').notNull().default(0),
        eloDelta: integer('elo_delta').notNull().default(0),
        createdAt: timestamp('created_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
    },
    (table) => [
        unique('ranking_performances_user_debate_unique').on(
            table.userId,
            table.debateId,
        ),
        check(
            'ranking_performances_side_check',
            sql`${table.side} in ('FOR', 'AGAINST')`,
        ),
        check(
            'ranking_performances_result_check',
            sql`${table.result} in ('WIN', 'LOSS', 'DRAW')`,
        ),
        check(
            'ranking_performances_final_score_check',
            sql`${table.finalScore} >= 0 and ${table.finalScore} <= 100`,
        ),
        check(
            'ranking_performances_opponent_score_check',
            sql`${table.opponentScore} is null or (${table.opponentScore} >= 0 and ${table.opponentScore} <= 100)`,
        ),
    ],
);
