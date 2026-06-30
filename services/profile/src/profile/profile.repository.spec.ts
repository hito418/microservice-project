import type { Kysely } from 'kysely';
import { describe, expect, it, vi } from 'vitest';
import type { Database, PlayerStatsRow } from '../db/database.types';
import { ProfileRepository } from './profile.repository';

function playerStatsRow(
    overrides: Partial<PlayerStatsRow> = {},
): PlayerStatsRow {
    return {
        user_id: '11111111-1111-1111-1111-111111111111',
        xp: 250,
        elo: 1400,
        debates_count: 2,
        wins: 1,
        losses: 1,
        draws: 0,
        created_at: new Date('2026-01-01T00:00:00Z'),
        updated_at: new Date('2026-01-01T00:00:00Z'),
        ...overrides,
    };
}

describe('ProfileRepository', () => {
    it('lists top stats sorted by Elo descending then XP descending', async () => {
        const rows = [playerStatsRow()];
        const captured: {
            orderBy: unknown[][];
            limit?: number;
        } = { orderBy: [] };
        const chain = {
            selectAll: vi.fn(() => chain),
            orderBy: vi.fn((...args: unknown[]) => {
                captured.orderBy.push(args);
                return chain;
            }),
            limit: vi.fn((limit: number) => {
                captured.limit = limit;
                return chain;
            }),
            execute: vi.fn().mockResolvedValue(rows),
        };
        const db = {
            selectFrom: vi.fn(() => chain),
        } as unknown as Kysely<Database>;
        const repo = new ProfileRepository(db);

        await expect(repo.listTopStats(25)).resolves.toBe(rows);

        expect(db.selectFrom).toHaveBeenCalledWith('player_stats');
        expect(captured.orderBy).toEqual([
            ['elo', 'desc'],
            ['xp', 'desc'],
            ['user_id', 'asc'],
        ]);
        expect(captured.limit).toBe(25);
    });
});
