import type { Kyselify } from 'drizzle-orm/kysely';
import type { Selectable } from 'kysely';
import { rankingPerformances } from './schema';

export type RankingPerformancesTable = Kyselify<typeof rankingPerformances>;

export interface Database {
    ranking_performances: RankingPerformancesTable;
}

export type RankingPerformanceRow = Selectable<RankingPerformancesTable>;
