import type { Kyselify } from 'drizzle-orm/kysely';
import type { Selectable } from 'kysely';
import { debates, spectatorVotes } from './schema';

export type DebatesTable = Kyselify<typeof debates>;
export type SpectatorVotesTable = Kyselify<typeof spectatorVotes>;

export interface Database {
    debates: DebatesTable;
    spectator_votes: SpectatorVotesTable;
}

export type DebateRow = Selectable<DebatesTable>;
export type SpectatorVoteRow = Selectable<SpectatorVotesTable>;
