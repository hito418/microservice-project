import type { Kyselify } from 'drizzle-orm/kysely';
import type { Selectable } from 'kysely';
import { profiles } from './schema';

export type ProfilesTable = Kyselify<typeof profiles>;

export interface Database {
    profiles: ProfilesTable;
}

export type ProfileRow = Selectable<ProfilesTable>;
