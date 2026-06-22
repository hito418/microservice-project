import { Inject, Injectable } from '@nestjs/common';
import { Kysely, sql } from 'kysely';
import { KYSELY } from '../db/database.module';
import type { Database, ProfileRow } from '../db/database.types';

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
}
