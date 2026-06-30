import type { Kyselify } from 'drizzle-orm/kysely';
import type { Selectable } from 'kysely';
import { playerStats, profiles } from './schema';

export type ProfilesTable = Kyselify<typeof profiles>;
export type PlayerStatsTable = Kyselify<typeof playerStats>;

export interface Database {
    profiles: ProfilesTable;
    player_stats: PlayerStatsTable;
}

export type ProfileRow = Selectable<ProfilesTable>;
export type PlayerStatsRow = Selectable<PlayerStatsTable>;
