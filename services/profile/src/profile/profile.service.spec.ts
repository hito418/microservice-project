import { status } from '@grpc/grpc-js';
import { RpcException } from '@nestjs/microservices';
import { listTopPlayerStatsSchema } from '@contracts/profile';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlayerStatsRow, ProfileRow } from '../db/database.types';
import { ProfileAlreadyExistsError, ProfileRepository } from './profile.repository';
import { ProfileService } from './profile.service';
import { deriveRankTierFromElo } from './rank-tier';

const USER_ID = '11111111-1111-1111-1111-111111111111';

function makeRepoMock(): ProfileRepository {
    return {
        findByUserId: vi.fn(),
        insert: vi.fn(),
        update: vi.fn(),
        deleteByUserId: vi.fn(),
        findStatsByUserId: vi.fn(),
        listTopStats: vi.fn(),
        upsertStats: vi.fn(),
        applyStatsDelta: vi.fn(),
    } as unknown as ProfileRepository;
}

function profileRow(overrides: Partial<ProfileRow> = {}): ProfileRow {
    return {
        user_id: USER_ID,
        display_name: 'Ada',
        avatar_url: null,
        created_at: new Date('2026-01-01T00:00:00Z'),
        updated_at: new Date('2026-01-01T00:00:00Z'),
        ...overrides,
    };
}

function playerStatsRow(overrides: Partial<PlayerStatsRow> = {}): PlayerStatsRow {
    return {
        user_id: USER_ID,
        xp: 0,
        elo: 1000,
        debates_count: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        created_at: new Date('2026-01-01T00:00:00Z'),
        updated_at: new Date('2026-01-01T00:00:00Z'),
        ...overrides,
    };
}

async function rpcErrorOf(
    run: () => Promise<unknown>,
): Promise<{ code: number; message: string }> {
    try {
        await run();
    } catch (err) {
        expect(err).toBeInstanceOf(RpcException);
        return (err as RpcException).getError() as { code: number; message: string };
    }
    throw new Error('expected the call to throw');
}

describe('deriveRankTierFromElo', () => {
    it.each([
        [0, 'BRONZE'],
        [1199, 'BRONZE'],
        [1200, 'SILVER'],
        [1399, 'SILVER'],
        [1400, 'GOLD'],
        [1599, 'GOLD'],
        [1600, 'PLATINUM'],
        [1799, 'PLATINUM'],
        [1800, 'DIAMOND'],
        [1999, 'DIAMOND'],
        [2000, 'MASTER'],
    ] as const)('maps elo %i to %s', (elo, rankTier) => {
        expect(deriveRankTierFromElo(elo)).toBe(rankTier);
    });
});

describe('ProfileService', () => {
    let repo: ProfileRepository;
    let service: ProfileService;

    beforeEach(() => {
        repo = makeRepoMock();
        service = new ProfileService(repo);
    });

    describe('createProfile', () => {
        it('inserts a profile owned by the authenticated user', async () => {
            vi.mocked(repo.insert).mockResolvedValue(
                profileRow({ display_name: 'Ada', avatar_url: 'https://x/a.png' }),
            );

            const result = await service.createProfile(
                { displayName: 'Ada', avatarUrl: 'https://x/a.png' },
                USER_ID,
            );

            expect(repo.insert).toHaveBeenCalledWith({
                userId: USER_ID,
                displayName: 'Ada',
                avatarUrl: 'https://x/a.png',
            });
            expect(result).toEqual({
                userId: USER_ID,
                displayName: 'Ada',
                avatarUrl: 'https://x/a.png',
                createdAt: '2026-01-01T00:00:00.000Z',
                updatedAt: '2026-01-01T00:00:00.000Z',
            });
        });

        it('maps a duplicate profile to ALREADY_EXISTS', async () => {
            vi.mocked(repo.insert).mockRejectedValue(
                new ProfileAlreadyExistsError(USER_ID),
            );

            const error = await rpcErrorOf(() =>
                service.createProfile({ displayName: 'Ada' }, USER_ID),
            );

            expect(error.code).toBe(status.ALREADY_EXISTS);
        });
    });

    describe('getProfile', () => {
        it('returns the profile when found', async () => {
            vi.mocked(repo.findByUserId).mockResolvedValue(profileRow());

            const result = await service.getProfile({ userId: USER_ID });

            expect(result.userId).toBe(USER_ID);
            expect(result.avatarUrl).toBeUndefined();
        });

        it('throws NOT_FOUND when missing', async () => {
            vi.mocked(repo.findByUserId).mockResolvedValue(undefined);

            const error = await rpcErrorOf(() =>
                service.getProfile({ userId: USER_ID }),
            );

            expect(error.code).toBe(status.NOT_FOUND);
        });
    });

    describe('updateProfile', () => {
        it('clears the avatar when given an empty string', async () => {
            vi.mocked(repo.update).mockResolvedValue(profileRow());

            await service.updateProfile({ avatarUrl: '' }, USER_ID);

            expect(repo.update).toHaveBeenCalledWith(USER_ID, {
                displayName: undefined,
                avatarUrl: null,
            });
        });

        it('leaves the avatar unchanged when omitted', async () => {
            vi.mocked(repo.update).mockResolvedValue(profileRow());

            await service.updateProfile({ displayName: 'Grace' }, USER_ID);

            expect(repo.update).toHaveBeenCalledWith(USER_ID, {
                displayName: 'Grace',
                avatarUrl: undefined,
            });
        });

        it('throws NOT_FOUND when the profile does not exist', async () => {
            vi.mocked(repo.update).mockResolvedValue(undefined);

            const error = await rpcErrorOf(() =>
                service.updateProfile({ displayName: 'Grace' }, USER_ID),
            );

            expect(error.code).toBe(status.NOT_FOUND);
        });
    });

    describe('deleteProfile', () => {
        it('returns the user id when deleted', async () => {
            vi.mocked(repo.deleteByUserId).mockResolvedValue(true);

            const result = await service.deleteProfile(USER_ID);

            expect(result).toEqual({ userId: USER_ID });
        });

        it('throws NOT_FOUND when nothing was deleted', async () => {
            vi.mocked(repo.deleteByUserId).mockResolvedValue(false);

            const error = await rpcErrorOf(() => service.deleteProfile(USER_ID));

            expect(error.code).toBe(status.NOT_FOUND);
        });
    });

    describe('getPlayerStats', () => {
        it('returns stats with computed winrate', async () => {
            vi.mocked(repo.findStatsByUserId).mockResolvedValue(
                playerStatsRow({
                    xp: 250,
                    elo: 1400,
                    debates_count: 3,
                    wins: 2,
                    losses: 1,
                }),
            );

            const result = await service.getPlayerStats({ userId: USER_ID });

            expect(repo.findStatsByUserId).toHaveBeenCalledWith(USER_ID);
            expect(result).toEqual({
                userId: USER_ID,
                xp: 250,
                elo: 1400,
                debatesCount: 3,
                wins: 2,
                losses: 1,
                draws: 0,
                winrate: 67,
                createdAt: '2026-01-01T00:00:00.000Z',
                updatedAt: '2026-01-01T00:00:00.000Z',
                rankTier: 'GOLD',
            });
        });

        it('returns winrate 0 when debatesCount is 0', async () => {
            vi.mocked(repo.findStatsByUserId).mockResolvedValue(playerStatsRow());

            const result = await service.getPlayerStats({ userId: USER_ID });

            expect(result.winrate).toBe(0);
        });

        it('throws NOT_FOUND when stats do not exist', async () => {
            vi.mocked(repo.findStatsByUserId).mockResolvedValue(undefined);

            const error = await rpcErrorOf(() =>
                service.getPlayerStats({ userId: USER_ID }),
            );

            expect(error.code).toBe(status.NOT_FOUND);
        });
    });

    describe('listTopPlayerStats', () => {
        it('returns top stats with computed fields', async () => {
            vi.mocked(repo.listTopStats).mockResolvedValue([
                playerStatsRow({
                    user_id: '22222222-2222-2222-2222-222222222222',
                    xp: 500,
                    elo: 1500,
                    debates_count: 4,
                    wins: 3,
                    losses: 1,
                }),
                playerStatsRow({
                    user_id: USER_ID,
                    xp: 250,
                    elo: 1400,
                    debates_count: 2,
                    wins: 1,
                    losses: 1,
                }),
            ]);

            const result = await service.listTopPlayerStats({ limit: 2 });

            expect(repo.listTopStats).toHaveBeenCalledWith(2);
            expect(result.items).toEqual([
                expect.objectContaining({
                    userId: '22222222-2222-2222-2222-222222222222',
                    elo: 1500,
                    xp: 500,
                    winrate: 75,
                    rankTier: 'GOLD',
                }),
                expect.objectContaining({
                    userId: USER_ID,
                    elo: 1400,
                    xp: 250,
                    winrate: 50,
                    rankTier: 'GOLD',
                }),
            ]);
        });

        it('defaults top stats limit', async () => {
            vi.mocked(repo.listTopStats).mockResolvedValue([]);

            await service.listTopPlayerStats({});

            expect(repo.listTopStats).toHaveBeenCalledWith(10);
        });
    });

    describe('upsertPlayerStats', () => {
        it('creates or updates stats and computes winrate', async () => {
            vi.mocked(repo.upsertStats).mockResolvedValue(
                playerStatsRow({
                    xp: 500,
                    elo: 1600,
                    debates_count: 4,
                    wins: 3,
                    losses: 1,
                }),
            );

            const result = await service.upsertPlayerStats({
                userId: USER_ID,
                xp: 500,
                elo: 1600,
                debatesCount: 4,
                wins: 3,
                losses: 1,
                draws: 0,
            });

            expect(repo.upsertStats).toHaveBeenCalledWith({
                userId: USER_ID,
                xp: 500,
                elo: 1600,
                debatesCount: 4,
                wins: 3,
                losses: 1,
                draws: 0,
            });
            expect(result.winrate).toBe(75);
            expect(result.rankTier).toBe('PLATINUM');
        });

        it('rejects mismatched debatesCount', async () => {
            const error = await rpcErrorOf(() =>
                service.upsertPlayerStats({
                    userId: USER_ID,
                    xp: 0,
                    elo: 1000,
                    debatesCount: 3,
                    wins: 1,
                    losses: 1,
                    draws: 0,
                }),
            );

            expect(error.code).toBe(status.INVALID_ARGUMENT);
            expect(repo.upsertStats).not.toHaveBeenCalled();
        });

        it('rejects negative values', async () => {
            const error = await rpcErrorOf(() =>
                service.upsertPlayerStats({
                    userId: USER_ID,
                    xp: -1,
                    elo: 1000,
                    debatesCount: 0,
                    wins: 0,
                    losses: 0,
                    draws: 0,
                }),
            );

            expect(error.code).toBe(status.INVALID_ARGUMENT);
        });
    });

    describe('applyPlayerStatsDelta', () => {
        it('creates stats if missing and applies a WIN delta', async () => {
            vi.mocked(repo.findStatsByUserId).mockResolvedValue(undefined);
            vi.mocked(repo.applyStatsDelta).mockResolvedValue(
                playerStatsRow({
                    xp: 40,
                    elo: 1015,
                    debates_count: 1,
                    wins: 1,
                }),
            );

            const result = await service.applyPlayerStatsDelta({
                userId: USER_ID,
                xpDelta: 40,
                eloDelta: 15,
                result: 'WIN',
            });

            expect(repo.applyStatsDelta).toHaveBeenCalledWith({
                userId: USER_ID,
                xpDelta: 40,
                eloDelta: 15,
                result: 'WIN',
            });
            expect(result).toMatchObject({
                xp: 40,
                elo: 1015,
                debatesCount: 1,
                wins: 1,
                losses: 0,
                draws: 0,
                winrate: 100,
                rankTier: 'BRONZE',
            });
        });

        it('applies a LOSS delta', async () => {
            vi.mocked(repo.findStatsByUserId).mockResolvedValue(playerStatsRow());
            vi.mocked(repo.applyStatsDelta).mockResolvedValue(
                playerStatsRow({
                    xp: 10,
                    elo: 990,
                    debates_count: 1,
                    losses: 1,
                }),
            );

            const result = await service.applyPlayerStatsDelta({
                userId: USER_ID,
                xpDelta: 10,
                eloDelta: -10,
                result: 'LOSS',
            });

            expect(result.losses).toBe(1);
            expect(result.winrate).toBe(0);
        });

        it('applies a DRAW delta', async () => {
            vi.mocked(repo.findStatsByUserId).mockResolvedValue(playerStatsRow());
            vi.mocked(repo.applyStatsDelta).mockResolvedValue(
                playerStatsRow({
                    xp: 15,
                    elo: 1000,
                    debates_count: 1,
                    draws: 1,
                }),
            );

            const result = await service.applyPlayerStatsDelta({
                userId: USER_ID,
                xpDelta: 15,
                eloDelta: 0,
                result: 'DRAW',
            });

            expect(result.draws).toBe(1);
        });

        it('allows negative eloDelta when final elo remains non-negative', async () => {
            vi.mocked(repo.findStatsByUserId).mockResolvedValue(
                playerStatsRow({ elo: 20 }),
            );
            vi.mocked(repo.applyStatsDelta).mockResolvedValue(
                playerStatsRow({ elo: 5, debates_count: 1, losses: 1 }),
            );

            const result = await service.applyPlayerStatsDelta({
                userId: USER_ID,
                xpDelta: 0,
                eloDelta: -15,
                result: 'LOSS',
            });

            expect(result.elo).toBe(5);
        });

        it('rejects final elo below zero', async () => {
            vi.mocked(repo.findStatsByUserId).mockResolvedValue(
                playerStatsRow({ elo: 10 }),
            );

            const error = await rpcErrorOf(() =>
                service.applyPlayerStatsDelta({
                    userId: USER_ID,
                    xpDelta: 0,
                    eloDelta: -11,
                    result: 'LOSS',
                }),
            );

            expect(error.code).toBe(status.INVALID_ARGUMENT);
            expect(repo.applyStatsDelta).not.toHaveBeenCalled();
        });

        it('rejects a negative xpDelta', async () => {
            const error = await rpcErrorOf(() =>
                service.applyPlayerStatsDelta({
                    userId: USER_ID,
                    xpDelta: -1,
                    eloDelta: 0,
                    result: 'WIN',
                }),
            );

            expect(error.code).toBe(status.INVALID_ARGUMENT);
            expect(repo.applyStatsDelta).not.toHaveBeenCalled();
        });

        it('rejects an invalid result', async () => {
            const error = await rpcErrorOf(() =>
                service.applyPlayerStatsDelta({
                    userId: USER_ID,
                    xpDelta: 0,
                    eloDelta: 0,
                    result: 'INVALID',
                }),
            );

            expect(error.code).toBe(status.INVALID_ARGUMENT);
            expect(repo.applyStatsDelta).not.toHaveBeenCalled();
        });
    });
});

describe('listTopPlayerStatsSchema', () => {
    it('validates limit bounds and default', () => {
        expect(listTopPlayerStatsSchema.parse({})).toEqual({ limit: 10 });
        expect(listTopPlayerStatsSchema.safeParse({ limit: 1 }).success).toBe(true);
        expect(listTopPlayerStatsSchema.safeParse({ limit: 100 }).success).toBe(
            true,
        );
        expect(listTopPlayerStatsSchema.safeParse({ limit: 0 }).success).toBe(
            false,
        );
        expect(listTopPlayerStatsSchema.safeParse({ limit: 101 }).success).toBe(
            false,
        );
    });
});
