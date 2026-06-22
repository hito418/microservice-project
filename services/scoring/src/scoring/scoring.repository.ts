import { Inject, Injectable } from '@nestjs/common';
import { Kysely, sql } from 'kysely';
import { KYSELY } from '../db/database.module';
import type {
    Database,
    DebateAiAnalysisResultRow,
    DebateFinalScoreRow,
    DebateRow,
    SpectatorVoteRow,
} from '../db/database.types';

const SPECTATOR_VOTES_UNIQUE = 'spectator_votes_debate_user_unique';

export class DuplicateSpectatorVoteError extends Error {
    constructor(debateId: string, userId: string) {
        super(`User ${userId} already voted on debate ${debateId}`);
    }
}

export type CreateSpectatorVoteRecord = {
    debateId: string;
    userId: string;
    side: string;
};

export type UpsertDebateRecord = {
    debateId: string;
    status: string;
};

export type SpectatorVoteCount = {
    side: string;
    votes: number;
};

export type UpsertAiAnalysisResultRecord = {
    debateId: string;
    status: string;
    summary?: string | null;
    forScore?: number | null;
    againstScore?: number | null;
    forFeedback?: string | null;
    againstFeedback?: string | null;
    errorMessage?: string | null;
};

export type UpsertFinalDebateScoreRecord = {
    debateId: string;
    aiForScore: number;
    aiAgainstScore: number;
    audienceForScore: number;
    audienceAgainstScore: number;
    finalForScore: number;
    finalAgainstScore: number;
    winnerSide: string;
};

function isDuplicateVote(err: unknown): boolean {
    if (typeof err !== 'object' || err === null) return false;
    const e = err as { code?: unknown; constraint?: unknown };
    return e.code === '23505' && e.constraint === SPECTATOR_VOTES_UNIQUE;
}

@Injectable()
export class ScoringRepository {
    constructor(@Inject(KYSELY) private readonly db: Kysely<Database>) {}

    findDebateById(debateId: string): Promise<DebateRow | undefined> {
        return this.db
            .selectFrom('debates')
            .selectAll()
            .where('id', '=', debateId)
            .executeTakeFirst();
    }

    upsertDebate(input: UpsertDebateRecord): Promise<DebateRow> {
        return this.db
            .insertInto('debates')
            .values({ id: input.debateId, status: input.status })
            .onConflict((oc) =>
                oc.column('id').doUpdateSet({ status: input.status }),
            )
            .returningAll()
            .executeTakeFirstOrThrow();
    }

    findVoteByDebateAndUser(
        debateId: string,
        userId: string,
    ): Promise<SpectatorVoteRow | undefined> {
        return this.db
            .selectFrom('spectator_votes')
            .selectAll()
            .where('debate_id', '=', debateId)
            .where('user_id', '=', userId)
            .executeTakeFirst();
    }

    async createSpectatorVote(
        input: CreateSpectatorVoteRecord,
    ): Promise<SpectatorVoteRow> {
        try {
            return await this.db
                .insertInto('spectator_votes')
                .values({
                    debate_id: input.debateId,
                    user_id: input.userId,
                    side: input.side,
                })
                .returningAll()
                .executeTakeFirstOrThrow();
        } catch (error) {
            if (isDuplicateVote(error)) {
                throw new DuplicateSpectatorVoteError(input.debateId, input.userId);
            }
            throw error;
        }
    }

    countSpectatorVotesBySide(debateId: string): Promise<SpectatorVoteCount[]> {
        return this.db
            .selectFrom('spectator_votes')
            .select([
                'side',
                sql<number>`count(*)::int`.as('votes'),
            ])
            .where('debate_id', '=', debateId)
            .groupBy('side')
            .execute();
    }

    upsertAiAnalysisResult(
        input: UpsertAiAnalysisResultRecord,
    ): Promise<DebateAiAnalysisResultRow> {
        const values = {
            debate_id: input.debateId,
            status: input.status,
            summary: input.summary ?? null,
            for_score: input.forScore ?? null,
            against_score: input.againstScore ?? null,
            for_feedback: input.forFeedback ?? null,
            against_feedback: input.againstFeedback ?? null,
            error_message: input.errorMessage ?? null,
        };

        return this.db
            .insertInto('debate_ai_analysis_results')
            .values(values)
            .onConflict((oc) =>
                oc.column('debate_id').doUpdateSet({
                    status: values.status,
                    summary: values.summary,
                    for_score: values.for_score,
                    against_score: values.against_score,
                    for_feedback: values.for_feedback,
                    against_feedback: values.against_feedback,
                    error_message: values.error_message,
                    updated_at: sql<Date>`now()`,
                }),
            )
            .returningAll()
            .executeTakeFirstOrThrow();
    }

    findAiAnalysisResultByDebateId(
        debateId: string,
    ): Promise<DebateAiAnalysisResultRow | undefined> {
        return this.db
            .selectFrom('debate_ai_analysis_results')
            .selectAll()
            .where('debate_id', '=', debateId)
            .executeTakeFirst();
    }

    upsertFinalDebateScore(
        input: UpsertFinalDebateScoreRecord,
    ): Promise<DebateFinalScoreRow> {
        const values = {
            debate_id: input.debateId,
            ai_for_score: input.aiForScore,
            ai_against_score: input.aiAgainstScore,
            audience_for_score: input.audienceForScore,
            audience_against_score: input.audienceAgainstScore,
            final_for_score: input.finalForScore,
            final_against_score: input.finalAgainstScore,
            winner_side: input.winnerSide,
        };

        return this.db
            .insertInto('debate_final_scores')
            .values(values)
            .onConflict((oc) =>
                oc.column('debate_id').doUpdateSet({
                    ai_for_score: values.ai_for_score,
                    ai_against_score: values.ai_against_score,
                    audience_for_score: values.audience_for_score,
                    audience_against_score: values.audience_against_score,
                    final_for_score: values.final_for_score,
                    final_against_score: values.final_against_score,
                    winner_side: values.winner_side,
                    updated_at: sql<Date>`now()`,
                }),
            )
            .returningAll()
            .executeTakeFirstOrThrow();
    }

    findFinalDebateScoreByDebateId(
        debateId: string,
    ): Promise<DebateFinalScoreRow | undefined> {
        return this.db
            .selectFrom('debate_final_scores')
            .selectAll()
            .where('debate_id', '=', debateId)
            .executeTakeFirst();
    }
}
