import { sql } from 'drizzle-orm';
import {
    check,
    integer,
    pgTable,
    text,
    timestamp,
    unique,
    uuid,
    varchar,
} from 'drizzle-orm/pg-core';

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

export const debateAiAnalysisResults = pgTable(
    'debate_ai_analysis_results',
    {
        debateId: varchar('debate_id', { length: 255 })
            .primaryKey()
            .references(() => debates.id, { onDelete: 'cascade' }),
        status: varchar('status', { length: 16 }).notNull(),
        summary: text('summary'),
        forScore: integer('for_score'),
        againstScore: integer('against_score'),
        forFeedback: text('for_feedback'),
        againstFeedback: text('against_feedback'),
        errorMessage: text('error_message'),
        createdAt: timestamp('created_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
        updatedAt: timestamp('updated_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
    },
    (table) => [
        check(
            'debate_ai_analysis_results_status_check',
            sql`${table.status} in ('COMPLETED', 'FAILED')`,
        ),
        check(
            'debate_ai_analysis_results_for_score_check',
            sql`${table.forScore} is null or (${table.forScore} >= 0 and ${table.forScore} <= 100)`,
        ),
        check(
            'debate_ai_analysis_results_against_score_check',
            sql`${table.againstScore} is null or (${table.againstScore} >= 0 and ${table.againstScore} <= 100)`,
        ),
    ],
);

export const debateFinalScores = pgTable(
    'debate_final_scores',
    {
        debateId: varchar('debate_id', { length: 255 })
            .primaryKey()
            .references(() => debates.id, { onDelete: 'cascade' }),
        aiForScore: integer('ai_for_score').notNull(),
        aiAgainstScore: integer('ai_against_score').notNull(),
        audienceForScore: integer('audience_for_score').notNull(),
        audienceAgainstScore: integer('audience_against_score').notNull(),
        finalForScore: integer('final_for_score').notNull(),
        finalAgainstScore: integer('final_against_score').notNull(),
        winnerSide: varchar('winner_side', { length: 16 }).notNull(),
        createdAt: timestamp('created_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
        updatedAt: timestamp('updated_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
    },
    (table) => [
        check(
            'debate_final_scores_ai_for_score_check',
            sql`${table.aiForScore} >= 0 and ${table.aiForScore} <= 100`,
        ),
        check(
            'debate_final_scores_ai_against_score_check',
            sql`${table.aiAgainstScore} >= 0 and ${table.aiAgainstScore} <= 100`,
        ),
        check(
            'debate_final_scores_audience_for_score_check',
            sql`${table.audienceForScore} >= 0 and ${table.audienceForScore} <= 100`,
        ),
        check(
            'debate_final_scores_audience_against_score_check',
            sql`${table.audienceAgainstScore} >= 0 and ${table.audienceAgainstScore} <= 100`,
        ),
        check(
            'debate_final_scores_final_for_score_check',
            sql`${table.finalForScore} >= 0 and ${table.finalForScore} <= 100`,
        ),
        check(
            'debate_final_scores_final_against_score_check',
            sql`${table.finalAgainstScore} >= 0 and ${table.finalAgainstScore} <= 100`,
        ),
        check(
            'debate_final_scores_winner_side_check',
            sql`${table.winnerSide} in ('FOR', 'AGAINST', 'DRAW')`,
        ),
    ],
);
