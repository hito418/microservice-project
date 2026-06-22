import { Inject, Injectable } from '@nestjs/common';
import { Kysely, sql } from 'kysely';
import { KYSELY } from '../db/database.module';
import type { Database, PlayerStatsRow, ProfileRow } from '../db/database.types';

const PROFILES_PKEY = 'profiles_pkey';

export class ProfileAlreadyExistsError extends Error {
    constructor(userId: string) {
        super(`Profile for user ${userId} already exists`);
    }
}

export type CreateProfileRecord = {
    userId: string;
    displayName: string;
    avatarUrl?: string | null;
};

// Only the fields a caller is allowed to change. `undefined` means "leave as
// is"; `null` (for avatarUrl) means "clear it".
export type UpdateProfileRecord = {
    displayName?: string;
    avatarUrl?: string | null;
};

export type UpsertPlayerStatsRecord = {
    userId: string;
    xp: number;
    elo: number;
    debatesCount: number;
    wins: number;
    losses: number;
    draws: number;
};

export type ApplyPlayerStatsDeltaRecord = {
    userId: string;
    xpDelta: number;
    eloDelta: number;
    result: string;
};

function isDuplicateProfile(err: unknown): boolean {
    if (typeof err !== 'object' || err === null) return false;
    const e = err as { code?: unknown; constraint?: unknown };
    return e.code === '23505' && e.constraint === PROFILES_PKEY;
}

@Injectable()
export class ProfileRepository {
    constructor(@Inject(KYSELY) private readonly db: Kysely<Database>) {}

    findByUserId(userId: string): Promise<ProfileRow | undefined> {
        return this.db
            .selectFrom('profiles')
            .selectAll()
            .where('user_id', '=', userId)
            .executeTakeFirst();
    }

    async insert(input: CreateProfileRecord): Promise<ProfileRow> {
        try {
            return await this.db
                .insertInto('profiles')
                .values({
                    user_id: input.userId,
                    display_name: input.displayName,
                    avatar_url: input.avatarUrl ?? null,
                })
                .returningAll()
                .executeTakeFirstOrThrow();
        } catch (error) {
            if (isDuplicateProfile(error)) {
                throw new ProfileAlreadyExistsError(input.userId);
            }
            throw error;
        }
    }

    update(
        userId: string,
        patch: UpdateProfileRecord,
    ): Promise<ProfileRow | undefined> {
        const values: Record<string, unknown> = { updated_at: sql<Date>`now()` };
        if (patch.displayName !== undefined) {
            values.display_name = patch.displayName;
        }
        if (patch.avatarUrl !== undefined) {
            values.avatar_url = patch.avatarUrl;
        }

        return this.db
            .updateTable('profiles')
            .set(values)
            .where('user_id', '=', userId)
            .returningAll()
            .executeTakeFirst();
    }

    async deleteByUserId(userId: string): Promise<boolean> {
        const result = await this.db
            .deleteFrom('profiles')
            .where('user_id', '=', userId)
            .executeTakeFirst();
        return result.numDeletedRows > 0n;
    }

    findStatsByUserId(userId: string): Promise<PlayerStatsRow | undefined> {
        return this.db
            .selectFrom('player_stats')
            .selectAll()
            .where('user_id', '=', userId)
            .executeTakeFirst();
    }

    upsertStats(input: UpsertPlayerStatsRecord): Promise<PlayerStatsRow> {
        const values = {
            user_id: input.userId,
            xp: input.xp,
            elo: input.elo,
            debates_count: input.debatesCount,
            wins: input.wins,
            losses: input.losses,
            draws: input.draws,
        };

        return this.db
            .insertInto('player_stats')
            .values(values)
            .onConflict((oc) =>
                oc.column('user_id').doUpdateSet({
                    xp: values.xp,
                    elo: values.elo,
                    debates_count: values.debates_count,
                    wins: values.wins,
                    losses: values.losses,
                    draws: values.draws,
                    updated_at: sql<Date>`now()`,
                }),
            )
            .returningAll()
            .executeTakeFirstOrThrow();
    }

    async applyStatsDelta(
        input: ApplyPlayerStatsDeltaRecord,
    ): Promise<PlayerStatsRow> {
        await this.db
            .insertInto('player_stats')
            .values({ user_id: input.userId })
            .onConflict((oc) => oc.column('user_id').doNothing())
            .executeTakeFirst();

        return this.db
            .updateTable('player_stats')
            .set({
                xp: sql<number>`xp + ${input.xpDelta}`,
                elo: sql<number>`elo + ${input.eloDelta}`,
                debates_count: sql<number>`debates_count + 1`,
                wins:
                    input.result === 'WIN'
                        ? sql<number>`wins + 1`
                        : sql<number>`wins`,
                losses:
                    input.result === 'LOSS'
                        ? sql<number>`losses + 1`
                        : sql<number>`losses`,
                draws:
                    input.result === 'DRAW'
                        ? sql<number>`draws + 1`
                        : sql<number>`draws`,
                updated_at: sql<Date>`now()`,
            })
            .where('user_id', '=', input.userId)
            .returningAll()
            .executeTakeFirstOrThrow();
    }
}
