import { describe, expect, it, vi } from 'vitest';
import type { Kysely } from 'kysely';
import type { Database, RankingPerformanceRow } from '../db/database.types';
import {
    DuplicatePerformanceError,
    RankingRepository,
} from './ranking.repository';

function performanceRow(
    overrides: Partial<RankingPerformanceRow> = {},
): RankingPerformanceRow {
    return {
        id: '33333333-3333-3333-3333-333333333333',
        user_id: '11111111-1111-1111-1111-111111111111',
        debate_id: 'debate-1',
        side: 'FOR',
        result: 'WIN',
        final_score: 84,
        opponent_score: 62,
        xp_delta: 0,
        elo_delta: 0,
        created_at: new Date('2026-01-01T00:00:00Z'),
        ...overrides,
    };
}

describe('RankingRepository', () => {
    it('records a performance row', async () => {
        const row = performanceRow();
        const captured: { values?: unknown } = {};
        const db = {
            insertInto: vi.fn(() => ({
                values: vi.fn((values: unknown) => {
                    captured.values = values;
                    return {
                        returningAll: vi.fn(() => ({
                            executeTakeFirstOrThrow: vi.fn().mockResolvedValue(row),
                        })),
                    };
                }),
            })),
        } as unknown as Kysely<Database>;
        const repo = new RankingRepository(db);

        await expect(
            repo.recordPerformance({
                userId: row.user_id,
                debateId: row.debate_id,
                side: row.side,
                result: row.result,
                finalScore: row.final_score,
                opponentScore: row.opponent_score,
                xpDelta: row.xp_delta,
                eloDelta: row.elo_delta,
            }),
        ).resolves.toBe(row);

        expect(db.insertInto).toHaveBeenCalledWith('ranking_performances');
        expect(captured.values).toMatchObject({
            user_id: row.user_id,
            debate_id: row.debate_id,
            final_score: row.final_score,
        });
    });

    it('maps unique violations to DuplicatePerformanceError', async () => {
        const db = {
            insertInto: vi.fn(() => ({
                values: vi.fn(() => ({
                    returningAll: vi.fn(() => ({
                        executeTakeFirstOrThrow: vi.fn().mockRejectedValue({
                            code: '23505',
                            constraint: 'ranking_performances_user_debate_unique',
                        }),
                    })),
                })),
            })),
        } as unknown as Kysely<Database>;
        const repo = new RankingRepository(db);

        await expect(
            repo.recordPerformance({
                userId: '11111111-1111-1111-1111-111111111111',
                debateId: 'debate-1',
                side: 'FOR',
                result: 'WIN',
                finalScore: 84,
                xpDelta: 0,
                eloDelta: 0,
            }),
        ).rejects.toBeInstanceOf(DuplicatePerformanceError);
    });

    it('lists a user history ordered by newest first with pagination', async () => {
        const rows = [performanceRow({ debate_id: 'debate-2' })];
        const captured: {
            where?: unknown[];
            orderBy: unknown[][];
            limit?: number;
            offset?: number;
        } = { orderBy: [] };
        const chain = {
            selectAll: vi.fn(() => chain),
            where: vi.fn((...args: unknown[]) => {
                captured.where = args;
                return chain;
            }),
            orderBy: vi.fn((...args: unknown[]) => {
                captured.orderBy.push(args);
                return chain;
            }),
            limit: vi.fn((limit: number) => {
                captured.limit = limit;
                return chain;
            }),
            offset: vi.fn((offset: number) => {
                captured.offset = offset;
                return chain;
            }),
            execute: vi.fn().mockResolvedValue(rows),
        };
        const db = {
            selectFrom: vi.fn(() => chain),
        } as unknown as Kysely<Database>;
        const repo = new RankingRepository(db);

        await expect(
            repo.listUserPerformanceHistory({
                userId: '11111111-1111-1111-1111-111111111111',
                limit: 10,
                offset: 5,
            }),
        ).resolves.toBe(rows);

        expect(db.selectFrom).toHaveBeenCalledWith('ranking_performances');
        expect(captured.where).toEqual([
            'user_id',
            '=',
            '11111111-1111-1111-1111-111111111111',
        ]);
        expect(captured.orderBy).toEqual([
            ['created_at', 'desc'],
            ['id', 'desc'],
        ]);
        expect(captured.limit).toBe(10);
        expect(captured.offset).toBe(5);
    });

    it('updates a performance Elo delta', async () => {
        const row = performanceRow({ elo_delta: 16 });
        const captured: {
            set?: unknown;
            where: unknown[][];
        } = { where: [] };
        const chain = {
            set: vi.fn((set: unknown) => {
                captured.set = set;
                return chain;
            }),
            where: vi.fn((...args: unknown[]) => {
                captured.where.push(args);
                return chain;
            }),
            returningAll: vi.fn(() => chain),
            executeTakeFirst: vi.fn().mockResolvedValue(row),
        };
        const db = {
            updateTable: vi.fn(() => chain),
        } as unknown as Kysely<Database>;
        const repo = new RankingRepository(db);

        await expect(
            repo.updatePerformanceEloDelta({
                userId: '11111111-1111-1111-1111-111111111111',
                debateId: 'debate-1',
                eloDelta: 16,
            }),
        ).resolves.toBe(row);

        expect(db.updateTable).toHaveBeenCalledWith('ranking_performances');
        expect(captured.set).toEqual({ elo_delta: 16 });
        expect(captured.where).toEqual([
            ['user_id', '=', '11111111-1111-1111-1111-111111111111'],
            ['debate_id', '=', 'debate-1'],
        ]);
    });
});
