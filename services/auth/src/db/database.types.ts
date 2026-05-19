import type { Kyselify } from 'drizzle-orm/kysely';
import type { Selectable } from 'kysely';
import { users } from './schema';

export type UsersTable = Kyselify<typeof users>;

export interface Database {
    users: UsersTable;
}

export type UserRow = Selectable<UsersTable>;
