import {
    computeXpForDebateCloseSchema,
    listUserPerformanceHistorySchema,
    recordPerformanceSchema,
} from '@contracts/ranking';
import type { PlayerStatsResponse, ProfileServiceClient } from '@contracts/profile';
import type {
    FinalDebateScoreResponse,
    ScoringServiceClient,
} from '@contracts/scoring';
import { status } from '@grpc/grpc-js';
import { RpcException } from '@nestjs/microservices';
import type { ClientGrpc } from '@nestjs/microservices';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import type { RankingPerformanceRow } from '../db/database.types';
import {
    DuplicatePerformanceError,
    RankingRepository,
} from './ranking.repository';
import { RankingService } from './ranking.service';

const USER_ID = '11111111-1111-1111-1111-111111111111';
const OTHER_USER_ID = '22222222-2222-2222-2222-222222222222';
const FOR_USER_ID = USER_ID;
const AGAINST_USER_ID = OTHER_USER_ID;

function makeRepoMock(): RankingRepository {
    return {
        recordPerformance: vi.fn(),
        listUserPerformanceHistory: vi.fn(),
        countUserPerformanceHistory: vi.fn(),
    } as unknown as RankingRepository;
}

function makeScoringClient(
    scoring: Partial<ScoringServiceClient> = {},
): ClientGrpc {
    return {
        getService: () => scoring,
    } as unknown as ClientGrpc;
}

function makeProfileClient(profile: Partial<ProfileServiceClient> = {}): ClientGrpc {
    return {
        getService: () => profile,
    } as unknown as ClientGrpc;
}

function performanceRow(
    overrides: Partial<RankingPerformanceRow> = {},
): RankingPerformanceRow {
    return {
        id: '33333333-3333-3333-3333-333333333333',
        user_id: USER_ID,
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

function finalScore(
    overrides: Partial<FinalDebateScoreResponse> = {},
): FinalDebateScoreResponse {
    return {
        debateId: 'debate-1',
        aiForScore: 80,
        aiAgainstScore: 20,
        audienceForScore: 60,
        audienceAgainstScore: 40,
        finalForScore: 70,
        finalAgainstScore: 30,
        winnerSide: 'FOR',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        ...overrides,
    };
}

function playerStatsResponse(
    overrides: Partial<PlayerStatsResponse> = {},
): PlayerStatsResponse {
    return {
        userId: USER_ID,
        xp: 0,
        elo: 1000,
        debatesCount: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        winrate: 0,
        rankTier: 'BRONZE',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
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
        return (err as RpcException).getError() as {
            code: number;
            message: string;
        };
    }
    throw new Error('expected an RpcException to be thrown');
}

describe('RankingService performance history', () => {
    let repo: RankingRepository;
    let service: RankingService;
    let scoring: {
        getFinalDebateScore: ReturnType<typeof vi.fn>;
    };
    let profile: {
        applyPlayerStatsDelta: ReturnType<typeof vi.fn>;
    };

    beforeEach(() => {
        repo = makeRepoMock();
        scoring = {
            getFinalDebateScore: vi.fn(),
        };
        profile = {
            applyPlayerStatsDelta: vi.fn(),
        };
        service = new RankingService(
            repo,
            makeScoringClient(scoring as Partial<ScoringServiceClient>),
            makeProfileClient(profile as Partial<ProfileServiceClient>),
        );
        service.onModuleInit();
    });

    it('records a performance', async () => {
        vi.mocked(repo.recordPerformance).mockResolvedValue(performanceRow());

        const result = await service.recordPerformance({
            userId: USER_ID,
            debateId: 'debate-1',
            side: 'FOR',
            result: 'WIN',
            finalScore: 84,
            opponentScore: 62,
            xpDelta: 0,
            eloDelta: 0,
        });

        expect(repo.recordPerformance).toHaveBeenCalledWith({
            userId: USER_ID,
            debateId: 'debate-1',
            side: 'FOR',
            result: 'WIN',
            finalScore: 84,
            opponentScore: 62,
            xpDelta: 0,
            eloDelta: 0,
        });
        expect(result).toEqual({
            id: '33333333-3333-3333-3333-333333333333',
            userId: USER_ID,
            debateId: 'debate-1',
            side: 'FOR',
            result: 'WIN',
            finalScore: 84,
            opponentScore: 62,
            xpDelta: 0,
            eloDelta: 0,
            createdAt: '2026-01-01T00:00:00.000Z',
        });
    });

    it('rejects duplicate user/debate performance', async () => {
        vi.mocked(repo.recordPerformance).mockRejectedValue(
            new DuplicatePerformanceError(USER_ID, 'debate-1'),
        );

        const error = await rpcErrorOf(() =>
            service.recordPerformance({
                userId: USER_ID,
                debateId: 'debate-1',
                side: 'FOR',
                result: 'WIN',
                finalScore: 84,
                xpDelta: 0,
                eloDelta: 0,
            }),
        );

        expect(error.code).toBe(status.ALREADY_EXISTS);
    });

    it('lists by userId with limit and offset', async () => {
        vi.mocked(repo.listUserPerformanceHistory).mockResolvedValue([
            performanceRow({ debate_id: 'debate-2' }),
            performanceRow({ debate_id: 'debate-1' }),
        ]);
        vi.mocked(repo.countUserPerformanceHistory).mockResolvedValue(5);

        const result = await service.listUserPerformanceHistory({
            userId: USER_ID,
            limit: 2,
            offset: 1,
        });

        expect(repo.listUserPerformanceHistory).toHaveBeenCalledWith({
            userId: USER_ID,
            limit: 2,
            offset: 1,
        });
        expect(repo.countUserPerformanceHistory).toHaveBeenCalledWith(USER_ID);
        expect(result.total).toBe(5);
        expect(result.items.map((item) => item.debateId)).toEqual([
            'debate-2',
            'debate-1',
        ]);
    });

    it('defaults history pagination', async () => {
        vi.mocked(repo.listUserPerformanceHistory).mockResolvedValue([]);
        vi.mocked(repo.countUserPerformanceHistory).mockResolvedValue(0);

        await service.listUserPerformanceHistory({ userId: USER_ID });

        expect(repo.listUserPerformanceHistory).toHaveBeenCalledWith({
            userId: USER_ID,
            limit: 20,
            offset: 0,
        });
    });

    it('keeps history isolated by userId at repository boundary', async () => {
        vi.mocked(repo.listUserPerformanceHistory).mockResolvedValue([
            performanceRow({ user_id: OTHER_USER_ID, debate_id: 'debate-9' }),
        ]);
        vi.mocked(repo.countUserPerformanceHistory).mockResolvedValue(1);

        await service.listUserPerformanceHistory({ userId: OTHER_USER_ID });

        expect(repo.listUserPerformanceHistory).toHaveBeenCalledWith(
            expect.objectContaining({ userId: OTHER_USER_ID }),
        );
        expect(repo.countUserPerformanceHistory).toHaveBeenCalledWith(
            OTHER_USER_ID,
        );
    });

    it('computes XP for winner and loser, applies profile deltas, and records history', async () => {
        scoring.getFinalDebateScore.mockReturnValue(
            of(finalScore({ finalForScore: 84, finalAgainstScore: 62 })),
        );
        profile.applyPlayerStatsDelta.mockImplementation(
            ({ userId }: { userId: string }) =>
                of(playerStatsResponse({ userId })),
        );
        vi.mocked(repo.recordPerformance)
            .mockResolvedValueOnce(
                performanceRow({
                    user_id: FOR_USER_ID,
                    side: 'FOR',
                    result: 'WIN',
                    final_score: 84,
                    opponent_score: 62,
                    xp_delta: 38,
                    elo_delta: 0,
                }),
            )
            .mockResolvedValueOnce(
                performanceRow({
                    user_id: AGAINST_USER_ID,
                    side: 'AGAINST',
                    result: 'LOSS',
                    final_score: 62,
                    opponent_score: 84,
                    xp_delta: 16,
                    elo_delta: 0,
                }),
            );

        const result = await service.computeXpForDebateClose({
            debateId: 'debate-1',
            forUserId: FOR_USER_ID,
            againstUserId: AGAINST_USER_ID,
        });

        expect(scoring.getFinalDebateScore).toHaveBeenCalledWith({
            debateId: 'debate-1',
        });
        expect(profile.applyPlayerStatsDelta).toHaveBeenCalledWith({
            userId: FOR_USER_ID,
            xpDelta: 38,
            eloDelta: 0,
            result: 'WIN',
        });
        expect(profile.applyPlayerStatsDelta).toHaveBeenCalledWith({
            userId: AGAINST_USER_ID,
            xpDelta: 16,
            eloDelta: 0,
            result: 'LOSS',
        });
        expect(repo.recordPerformance).toHaveBeenCalledWith(
            expect.objectContaining({
                userId: FOR_USER_ID,
                result: 'WIN',
                xpDelta: 38,
                eloDelta: 0,
            }),
        );
        expect(repo.recordPerformance).toHaveBeenCalledWith(
            expect.objectContaining({
                userId: AGAINST_USER_ID,
                result: 'LOSS',
                xpDelta: 16,
                eloDelta: 0,
            }),
        );
        expect(result).toMatchObject({
            debateId: 'debate-1',
            winnerSide: 'FOR',
            performances: [
                { userId: FOR_USER_ID, xpDelta: 38, eloDelta: 0 },
                { userId: AGAINST_USER_ID, xpDelta: 16, eloDelta: 0 },
            ],
        });
    });

    it('computes XP when AGAINST wins', async () => {
        scoring.getFinalDebateScore.mockReturnValue(
            of(
                finalScore({
                    finalForScore: 40,
                    finalAgainstScore: 75,
                    winnerSide: 'AGAINST',
                }),
            ),
        );
        profile.applyPlayerStatsDelta.mockImplementation(
            ({ userId }: { userId: string }) =>
                of(playerStatsResponse({ userId })),
        );
        vi.mocked(repo.recordPerformance)
            .mockResolvedValueOnce(
                performanceRow({
                    user_id: FOR_USER_ID,
                    side: 'FOR',
                    result: 'LOSS',
                    final_score: 40,
                    opponent_score: 75,
                    xp_delta: 14,
                }),
            )
            .mockResolvedValueOnce(
                performanceRow({
                    user_id: AGAINST_USER_ID,
                    side: 'AGAINST',
                    result: 'WIN',
                    final_score: 75,
                    opponent_score: 40,
                    xp_delta: 38,
                }),
            );

        await service.computeXpForDebateClose({
            debateId: 'debate-1',
            forUserId: FOR_USER_ID,
            againstUserId: AGAINST_USER_ID,
        });

        expect(profile.applyPlayerStatsDelta).toHaveBeenCalledWith(
            expect.objectContaining({
                userId: FOR_USER_ID,
                xpDelta: 14,
                eloDelta: 0,
                result: 'LOSS',
            }),
        );
        expect(profile.applyPlayerStatsDelta).toHaveBeenCalledWith(
            expect.objectContaining({
                userId: AGAINST_USER_ID,
                xpDelta: 38,
                eloDelta: 0,
                result: 'WIN',
            }),
        );
    });

    it('computes XP for a draw', async () => {
        scoring.getFinalDebateScore.mockReturnValue(
            of(
                finalScore({
                    finalForScore: 50,
                    finalAgainstScore: 50,
                    winnerSide: 'DRAW',
                }),
            ),
        );
        profile.applyPlayerStatsDelta.mockImplementation(
            ({ userId }: { userId: string }) =>
                of(playerStatsResponse({ userId })),
        );
        vi.mocked(repo.recordPerformance)
            .mockResolvedValueOnce(
                performanceRow({
                    user_id: FOR_USER_ID,
                    result: 'DRAW',
                    final_score: 50,
                    opponent_score: 50,
                    xp_delta: 25,
                }),
            )
            .mockResolvedValueOnce(
                performanceRow({
                    user_id: AGAINST_USER_ID,
                    side: 'AGAINST',
                    result: 'DRAW',
                    final_score: 50,
                    opponent_score: 50,
                    xp_delta: 25,
                }),
            );

        await service.computeXpForDebateClose({
            debateId: 'debate-1',
            forUserId: FOR_USER_ID,
            againstUserId: AGAINST_USER_ID,
        });

        expect(profile.applyPlayerStatsDelta).toHaveBeenCalledWith(
            expect.objectContaining({
                userId: FOR_USER_ID,
                xpDelta: 25,
                eloDelta: 0,
                result: 'DRAW',
            }),
        );
        expect(profile.applyPlayerStatsDelta).toHaveBeenCalledWith(
            expect.objectContaining({
                userId: AGAINST_USER_ID,
                xpDelta: 25,
                eloDelta: 0,
                result: 'DRAW',
            }),
        );
    });

    it('rejects missing final score', async () => {
        scoring.getFinalDebateScore.mockReturnValue(
            throwError(() => ({ code: status.NOT_FOUND })),
        );

        const error = await rpcErrorOf(() =>
            service.computeXpForDebateClose({
                debateId: 'debate-1',
                forUserId: FOR_USER_ID,
                againstUserId: AGAINST_USER_ID,
            }),
        );

        expect(error.code).toBe(status.FAILED_PRECONDITION);
        expect(profile.applyPlayerStatsDelta).not.toHaveBeenCalled();
        expect(repo.recordPerformance).not.toHaveBeenCalled();
    });
});

describe('ranking performance schemas', () => {
    const validRecord = {
        userId: USER_ID,
        debateId: 'debate-1',
        side: 'FOR',
        result: 'WIN',
        finalScore: 84,
        opponentScore: 62,
        xpDelta: 0,
        eloDelta: 0,
    } as const;

    it('accepts a valid performance record', () => {
        expect(recordPerformanceSchema.safeParse(validRecord).success).toBe(true);
    });

    it('rejects invalid finalScore', () => {
        expect(
            recordPerformanceSchema.safeParse({
                ...validRecord,
                finalScore: 101,
            }).success,
        ).toBe(false);
    });

    it('rejects invalid opponentScore', () => {
        expect(
            recordPerformanceSchema.safeParse({
                ...validRecord,
                opponentScore: -1,
            }).success,
        ).toBe(false);
    });

    it('rejects invalid side', () => {
        expect(
            recordPerformanceSchema.safeParse({
                ...validRecord,
                side: 'MAYBE',
            }).success,
        ).toBe(false);
    });

    it('rejects invalid result', () => {
        expect(
            recordPerformanceSchema.safeParse({
                ...validRecord,
                result: 'PARTIAL',
            }).success,
        ).toBe(false);
    });

    it('defaults deltas to zero', () => {
        const { xpDelta: _xpDelta, eloDelta: _eloDelta, ...payload } = validRecord;

        expect(recordPerformanceSchema.parse(payload)).toMatchObject({
            xpDelta: 0,
            eloDelta: 0,
        });
    });

    it('validates history limit and offset', () => {
        expect(
            listUserPerformanceHistorySchema.safeParse({
                userId: USER_ID,
                limit: 100,
                offset: 0,
            }).success,
        ).toBe(true);
        expect(
            listUserPerformanceHistorySchema.safeParse({
                userId: USER_ID,
                limit: 101,
                offset: 0,
            }).success,
        ).toBe(false);
        expect(
            listUserPerformanceHistorySchema.safeParse({
                userId: USER_ID,
                limit: 20,
                offset: -1,
            }).success,
        ).toBe(false);
    });

    it('validates debate close XP players', () => {
        expect(
            computeXpForDebateCloseSchema.safeParse({
                debateId: 'debate-1',
                forUserId: FOR_USER_ID,
                againstUserId: AGAINST_USER_ID,
            }).success,
        ).toBe(true);
        expect(
            computeXpForDebateCloseSchema.safeParse({
                debateId: 'debate-1',
                forUserId: FOR_USER_ID,
                againstUserId: FOR_USER_ID,
            }).success,
        ).toBe(false);
        expect(
            computeXpForDebateCloseSchema.safeParse({
                debateId: 'debate-1',
                forUserId: 'not-a-uuid',
                againstUserId: AGAINST_USER_ID,
            }).success,
        ).toBe(false);
    });
});
