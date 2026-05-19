import { Inject, Injectable } from '@nestjs/common';
import { Kysely } from 'kysely';
import { KYSELY } from '../db/database.module';
import type { Database, UserRow } from '../db/database.types';

export interface NewUserInput {
    email: string;
    passwordHash: string;
}

@Injectable()
export class UsersRepository {
    constructor(@Inject(KYSELY) private readonly db: Kysely<Database>) {}

    findByEmail(email: string): Promise<UserRow | undefined> {
        return this.db
            .selectFrom('users')
            .selectAll()
            .where('email', '=', email)
            .executeTakeFirst();
    }

    insert(input: NewUserInput): Promise<UserRow> {
        return this.db
            .insertInto('users')
            .values({
                email: input.email,
                password_hash: input.passwordHash,
            })
            .returningAll()
            .executeTakeFirstOrThrow();
    }
}
