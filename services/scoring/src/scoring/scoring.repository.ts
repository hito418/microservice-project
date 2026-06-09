import { Inject, Injectable } from '@nestjs/common';
import { Kysely } from 'kysely';
import { KYSELY } from '../db/database.module';
import type { Database, DebateRow, SpectatorVoteRow } from '../db/database.types';

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
}
