import type { Kyselify } from 'drizzle-orm/kysely';
import type { Selectable } from 'kysely';
import {
    debateAiAnalysisResults,
    debateFinalScores,
    debates,
    spectatorVotes,
} from './schema';

export type DebatesTable = Kyselify<typeof debates>;
export type SpectatorVotesTable = Kyselify<typeof spectatorVotes>;
export type DebateAiAnalysisResultsTable = Kyselify<typeof debateAiAnalysisResults>;
export type DebateFinalScoresTable = Kyselify<typeof debateFinalScores>;

export interface Database {
    debates: DebatesTable;
    spectator_votes: SpectatorVotesTable;
    debate_ai_analysis_results: DebateAiAnalysisResultsTable;
    debate_final_scores: DebateFinalScoresTable;
}

export type DebateRow = Selectable<DebatesTable>;
export type SpectatorVoteRow = Selectable<SpectatorVotesTable>;
export type DebateAiAnalysisResultRow = Selectable<DebateAiAnalysisResultsTable>;
export type DebateFinalScoreRow = Selectable<DebateFinalScoresTable>;
