import type { Kyselify } from 'drizzle-orm/kysely';
import type { Selectable } from 'kysely';
import { debateAiAnalysisResults, debates, spectatorVotes } from './schema';

export type DebatesTable = Kyselify<typeof debates>;
export type SpectatorVotesTable = Kyselify<typeof spectatorVotes>;
export type DebateAiAnalysisResultsTable = Kyselify<typeof debateAiAnalysisResults>;

export interface Database {
    debates: DebatesTable;
    spectator_votes: SpectatorVotesTable;
    debate_ai_analysis_results: DebateAiAnalysisResultsTable;
}

export type DebateRow = Selectable<DebatesTable>;
export type SpectatorVoteRow = Selectable<SpectatorVotesTable>;
export type DebateAiAnalysisResultRow = Selectable<DebateAiAnalysisResultsTable>;
