import { Inject, Injectable } from '@nestjs/common';
import { sql, type Kysely } from 'kysely';
import { KYSELY } from '../db/database.module';
import type { Database, RankingPerformanceRow } from '../db/database.types';

const RANKING_PERFORMANCES_UNIQUE =
    'ranking_performances_user_debate_unique';

export class DuplicatePerformanceError extends Error {
    constructor(userId: string, debateId: string) {
        super(`Performance for user ${userId} on debate ${debateId} already exists`);
    }
}

export type RecordPerformanceInput = {
    userId: string;
    debateId: string;
    side: string;
    result: string;
    finalScore: number;
    opponentScore?: number | null;
    xpDelta: number;
    eloDelta: number;
};

export type ListUserPerformanceHistoryInput = {
    userId: string;
    limit: number;
    offset: number;
};

export type UpdatePerformanceEloDeltaInput = {
    userId: string;
    debateId: string;
    eloDelta: number;
};

function isDuplicatePerformance(err: unknown): boolean {
    if (typeof err !== 'object' || err === null) return false;
    const e = err as { code?: unknown; constraint?: unknown };
    return e.code === '23505' && e.constraint === RANKING_PERFORMANCES_UNIQUE;
}

@Injectable()
export class RankingRepository {
    constructor(@Inject(KYSELY) private readonly db: Kysely<Database>) {}

    async recordPerformance(
        input: RecordPerformanceInput,
    ): Promise<RankingPerformanceRow> {
        try {
            return await this.db
                .insertInto('ranking_performances')
                .values({
                    user_id: input.userId,
                    debate_id: input.debateId,
                    side: input.side,
                    result: input.result,
                    final_score: input.finalScore,
                    opponent_score: input.opponentScore ?? null,
                    xp_delta: input.xpDelta,
                    elo_delta: input.eloDelta,
                })
                .returningAll()
                .executeTakeFirstOrThrow();
        } catch (error) {
            if (isDuplicatePerformance(error)) {
                throw new DuplicatePerformanceError(input.userId, input.debateId);
            }
            throw error;
        }
    }

    listUserPerformanceHistory(
        input: ListUserPerformanceHistoryInput,
    ): Promise<RankingPerformanceRow[]> {
        return this.db
            .selectFrom('ranking_performances')
            .selectAll()
            .where('user_id', '=', input.userId)
            .orderBy('created_at', 'desc')
            .orderBy('id', 'desc')
            .limit(input.limit)
            .offset(input.offset)
            .execute();
    }

    async countUserPerformanceHistory(userId: string): Promise<number> {
        const row = await this.db
            .selectFrom('ranking_performances')
            .select(sql<number>`count(*)::int`.as('total'))
            .where('user_id', '=', userId)
            .executeTakeFirstOrThrow();
        return row.total;
    }

    updatePerformanceEloDelta(
        input: UpdatePerformanceEloDeltaInput,
    ): Promise<RankingPerformanceRow | undefined> {
        return this.db
            .updateTable('ranking_performances')
            .set({ elo_delta: input.eloDelta })
            .where('user_id', '=', input.userId)
            .where('debate_id', '=', input.debateId)
            .returningAll()
            .executeTakeFirst();
    }
}
