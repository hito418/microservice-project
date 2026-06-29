import {
    listUserPerformanceHistorySchema,
    recordPerformanceSchema,
} from '@contracts/ranking';
import { status } from '@grpc/grpc-js';
import { RpcException } from '@nestjs/microservices';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RankingPerformanceRow } from '../db/database.types';
import {
    DuplicatePerformanceError,
    RankingRepository,
} from './ranking.repository';
import { RankingService } from './ranking.service';

const USER_ID = '11111111-1111-1111-1111-111111111111';
const OTHER_USER_ID = '22222222-2222-2222-2222-222222222222';

function makeRepoMock(): RankingRepository {
    return {
        recordPerformance: vi.fn(),
        listUserPerformanceHistory: vi.fn(),
        countUserPerformanceHistory: vi.fn(),
    } as unknown as RankingRepository;
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

    beforeEach(() => {
        repo = makeRepoMock();
        service = new RankingService(repo);
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
}
);
