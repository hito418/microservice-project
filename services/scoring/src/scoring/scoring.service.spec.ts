import { status } from '@grpc/grpc-js';
import { RpcException } from '@nestjs/microservices';
import {
    computeFinalDebateScoreSchema,
    getAiAnalysisResultSchema,
    getFinalDebateScoreSchema,
    getRandomRecentDebateForVotingSchema,
    storeAiAnalysisResultSchema,
} from '@contracts/scoring';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Kysely } from 'kysely';
import type {
    Database,
    DebateAiAnalysisResultRow,
    DebateFinalScoreRow,
    DebateRow,
} from '../db/database.types';
import { DebateJobsProducer } from '../jobs/debate-jobs.producer';
import {
    ScoringRepository,
    type RecentDebateForVotingCandidate,
} from './scoring.repository';
import { ScoringService } from './scoring.service';

afterEach(() => {
    vi.restoreAllMocks();
});

function makeRepoMock(): ScoringRepository {
    return {
        findDebateById: vi.fn(),
        upsertDebate: vi.fn(),
        findVoteByDebateAndUser: vi.fn(),
        createSpectatorVote: vi.fn(),
        countSpectatorVotesBySide: vi.fn(),
        upsertAiAnalysisResult: vi.fn(),
        findAiAnalysisResultByDebateId: vi.fn(),
        upsertFinalDebateScore: vi.fn(),
        findFinalDebateScoreByDebateId: vi.fn(),
        findRecentDebatesForVoting: vi.fn(),
    } as unknown as ScoringRepository;
}

function makeProducerMock(): DebateJobsProducer {
    return {
        enqueueFinalization: vi.fn().mockResolvedValue(undefined),
        onModuleDestroy: vi.fn().mockResolvedValue(undefined),
    } as unknown as DebateJobsProducer;
}

function makeService(
    repo: ScoringRepository,
    producer: DebateJobsProducer = makeProducerMock(),
): ScoringService {
    return new ScoringService(repo, producer);
}

function debateRow(overrides: Partial<DebateRow> = {}): DebateRow {
    return {
        id: 'debate-1',
        status: 'CLOSED',
        created_at: new Date('2026-01-01T00:00:00Z'),
        updated_at: new Date('2026-01-01T00:00:00Z'),
        ...overrides,
    };
}

function aiResultRow(
    overrides: Partial<DebateAiAnalysisResultRow> = {},
): DebateAiAnalysisResultRow {
    return {
        debate_id: 'debate-1',
        status: 'COMPLETED',
        summary: 'FOR had stronger evidence.',
        for_score: 72,
        against_score: 28,
        for_feedback: 'Clear argumentation.',
        against_feedback: 'Needs more evidence.',
        error_message: null,
        created_at: new Date('2026-01-01T00:00:00Z'),
        updated_at: new Date('2026-01-01T00:00:00Z'),
        ...overrides,
    };
}

function recentDebateCandidate(
    overrides: Partial<RecentDebateForVotingCandidate> = {},
): RecentDebateForVotingCandidate {
    return {
        debateId: 'debate-1',
        status: 'VOTING',
        voteCount: 2,
        referenceTime: new Date('2026-01-01T00:15:00Z'),
        ...overrides,
    };
}

function finalScoreRow(
    overrides: Partial<DebateFinalScoreRow> = {},
): DebateFinalScoreRow {
    return {
        debate_id: 'debate-1',
        ai_for_score: 80,
        ai_against_score: 20,
        audience_for_score: 60,
        audience_against_score: 40,
        final_for_score: 70,
        final_against_score: 30,
        winner_side: 'FOR',
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
        return (err as RpcException).getError() as {
            code: number;
            message: string;
        };
    }
    throw new Error('expected an RpcException to be thrown');
}

describe('ScoringService AI analysis results', () => {
    it('stores a COMPLETED result successfully', async () => {
        const repo = makeRepoMock();
        const service = makeService(repo);
        vi.mocked(repo.findDebateById).mockResolvedValue(debateRow());
        vi.mocked(repo.upsertAiAnalysisResult).mockResolvedValue(aiResultRow());

        const result = await service.storeAiAnalysisResult({
            debateId: 'debate-1',
            status: 'COMPLETED',
            summary: 'FOR had stronger evidence.',
            forScore: 72,
            againstScore: 28,
            forFeedback: 'Clear argumentation.',
            againstFeedback: 'Needs more evidence.',
        });

        expect(repo.upsertAiAnalysisResult).toHaveBeenCalledWith({
            debateId: 'debate-1',
            status: 'COMPLETED',
            summary: 'FOR had stronger evidence.',
            forScore: 72,
            againstScore: 28,
            forFeedback: 'Clear argumentation.',
            againstFeedback: 'Needs more evidence.',
            errorMessage: undefined,
        });
        expect(result).toEqual({
            debateId: 'debate-1',
            status: 'COMPLETED',
            summary: 'FOR had stronger evidence.',
            forScore: 72,
            againstScore: 28,
            forFeedback: 'Clear argumentation.',
            againstFeedback: 'Needs more evidence.',
            errorMessage: undefined,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
        });
    });

    it('gets a stored COMPLETED result', async () => {
        const repo = makeRepoMock();
        const service = makeService(repo);
        vi.mocked(repo.findAiAnalysisResultByDebateId).mockResolvedValue(aiResultRow());

        const result = await service.getAiAnalysisResult({ debateId: 'debate-1' });

        expect(repo.findAiAnalysisResultByDebateId).toHaveBeenCalledWith('debate-1');
        expect(result.forScore).toBe(72);
        expect(result.againstScore).toBe(28);
    });

    it('stores a FAILED result with an errorMessage', async () => {
        const repo = makeRepoMock();
        const service = makeService(repo);
        vi.mocked(repo.findDebateById).mockResolvedValue(debateRow());
        vi.mocked(repo.upsertAiAnalysisResult).mockResolvedValue(
            aiResultRow({
                status: 'FAILED',
                summary: null,
                for_score: null,
                against_score: null,
                for_feedback: null,
                against_feedback: null,
                error_message: 'OpenRouter unavailable',
            }),
        );

        const result = await service.storeAiAnalysisResult({
            debateId: 'debate-1',
            status: 'FAILED',
            errorMessage: 'OpenRouter unavailable',
        });

        expect(result).toMatchObject({
            debateId: 'debate-1',
            status: 'FAILED',
            errorMessage: 'OpenRouter unavailable',
        });
        expect(result.summary).toBeUndefined();
        expect(result.forScore).toBeUndefined();
    });

    it('rejects an unknown debate when storing a result', async () => {
        const repo = makeRepoMock();
        const service = makeService(repo);
        vi.mocked(repo.findDebateById).mockResolvedValue(undefined);

        const error = await rpcErrorOf(() =>
            service.storeAiAnalysisResult({
                debateId: 'missing',
                status: 'FAILED',
                errorMessage: 'OpenRouter unavailable',
            }),
        );

        expect(error.code).toBe(status.NOT_FOUND);
        expect(repo.upsertAiAnalysisResult).not.toHaveBeenCalled();
    });

    it('returns NOT_FOUND when no analysis result exists', async () => {
        const repo = makeRepoMock();
        const service = makeService(repo);
        vi.mocked(repo.findAiAnalysisResultByDebateId).mockResolvedValue(undefined);

        const error = await rpcErrorOf(() =>
            service.getAiAnalysisResult({ debateId: 'debate-1' }),
        );

        expect(error.code).toBe(status.NOT_FOUND);
    });
});

describe('ScoringService final debate scores', () => {
    it('computes a final score with 50/50 weighting', async () => {
        const repo = makeRepoMock();
        const service = makeService(repo);
        vi.mocked(repo.findDebateById).mockResolvedValue(debateRow());
        vi.mocked(repo.findAiAnalysisResultByDebateId).mockResolvedValue(
            aiResultRow({ for_score: 80, against_score: 20 }),
        );
        vi.mocked(repo.countSpectatorVotesBySide).mockResolvedValue([
            { side: 'FOR', votes: 3 },
            { side: 'AGAINST', votes: 2 },
        ]);
        vi.mocked(repo.upsertFinalDebateScore).mockResolvedValue(finalScoreRow());

        const result = await service.computeFinalDebateScore({
            debateId: 'debate-1',
        });

        expect(repo.upsertFinalDebateScore).toHaveBeenCalledWith({
            debateId: 'debate-1',
            aiForScore: 80,
            aiAgainstScore: 20,
            audienceForScore: 60,
            audienceAgainstScore: 40,
            finalForScore: 70,
            finalAgainstScore: 30,
            winnerSide: 'FOR',
        });
        expect(result).toEqual({
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
        });
    });

    it('rounds .5 final scores correctly', async () => {
        const repo = makeRepoMock();
        const service = makeService(repo);
        vi.mocked(repo.findDebateById).mockResolvedValue(debateRow());
        vi.mocked(repo.findAiAnalysisResultByDebateId).mockResolvedValue(
            aiResultRow({ for_score: 67, against_score: 33 }),
        );
        vi.mocked(repo.countSpectatorVotesBySide).mockResolvedValue([
            { side: 'FOR', votes: 1 },
            { side: 'AGAINST', votes: 1 },
        ]);
        vi.mocked(repo.upsertFinalDebateScore).mockResolvedValue(
            finalScoreRow({
                ai_for_score: 67,
                ai_against_score: 33,
                audience_for_score: 50,
                audience_against_score: 50,
                final_for_score: 59,
                final_against_score: 42,
                winner_side: 'FOR',
            }),
        );

        await service.computeFinalDebateScore({ debateId: 'debate-1' });

        expect(repo.upsertFinalDebateScore).toHaveBeenCalledWith(
            expect.objectContaining({
                finalForScore: 59,
                finalAgainstScore: 42,
            }),
        );
    });

    it('computes DRAW winner', async () => {
        const repo = makeRepoMock();
        const service = makeService(repo);
        vi.mocked(repo.findDebateById).mockResolvedValue(debateRow());
        vi.mocked(repo.findAiAnalysisResultByDebateId).mockResolvedValue(
            aiResultRow({ for_score: 50, against_score: 50 }),
        );
        vi.mocked(repo.countSpectatorVotesBySide).mockResolvedValue([
            { side: 'FOR', votes: 1 },
            { side: 'AGAINST', votes: 1 },
        ]);
        vi.mocked(repo.upsertFinalDebateScore).mockResolvedValue(
            finalScoreRow({
                ai_for_score: 50,
                ai_against_score: 50,
                audience_for_score: 50,
                audience_against_score: 50,
                final_for_score: 50,
                final_against_score: 50,
                winner_side: 'DRAW',
            }),
        );

        await service.computeFinalDebateScore({ debateId: 'debate-1' });

        expect(repo.upsertFinalDebateScore).toHaveBeenCalledWith(
            expect.objectContaining({ winnerSide: 'DRAW' }),
        );
    });

    it('computes AGAINST winner', async () => {
        const repo = makeRepoMock();
        const service = makeService(repo);
        vi.mocked(repo.findDebateById).mockResolvedValue(debateRow());
        vi.mocked(repo.findAiAnalysisResultByDebateId).mockResolvedValue(
            aiResultRow({ for_score: 20, against_score: 80 }),
        );
        vi.mocked(repo.countSpectatorVotesBySide).mockResolvedValue([
            { side: 'AGAINST', votes: 1 },
        ]);
        vi.mocked(repo.upsertFinalDebateScore).mockResolvedValue(
            finalScoreRow({
                ai_for_score: 20,
                ai_against_score: 80,
                audience_for_score: 0,
                audience_against_score: 100,
                final_for_score: 10,
                final_against_score: 90,
                winner_side: 'AGAINST',
            }),
        );

        await service.computeFinalDebateScore({ debateId: 'debate-1' });

        expect(repo.upsertFinalDebateScore).toHaveBeenCalledWith(
            expect.objectContaining({ winnerSide: 'AGAINST' }),
        );
    });

    it('computes with no audience votes as 0/0 audience scores', async () => {
        const repo = makeRepoMock();
        const service = makeService(repo);
        vi.mocked(repo.findDebateById).mockResolvedValue(debateRow());
        vi.mocked(repo.findAiAnalysisResultByDebateId).mockResolvedValue(
            aiResultRow({ for_score: 80, against_score: 20 }),
        );
        vi.mocked(repo.countSpectatorVotesBySide).mockResolvedValue([]);
        vi.mocked(repo.upsertFinalDebateScore).mockResolvedValue(
            finalScoreRow({
                audience_for_score: 0,
                audience_against_score: 0,
                final_for_score: 40,
                final_against_score: 10,
            }),
        );

        await service.computeFinalDebateScore({ debateId: 'debate-1' });

        expect(repo.upsertFinalDebateScore).toHaveBeenCalledWith(
            expect.objectContaining({
                audienceForScore: 0,
                audienceAgainstScore: 0,
                finalForScore: 40,
                finalAgainstScore: 10,
            }),
        );
    });

    it('rejects an unknown debate', async () => {
        const repo = makeRepoMock();
        const service = makeService(repo);
        vi.mocked(repo.findDebateById).mockResolvedValue(undefined);

        const error = await rpcErrorOf(() =>
            service.computeFinalDebateScore({ debateId: 'missing' }),
        );

        expect(error.code).toBe(status.NOT_FOUND);
        expect(repo.upsertFinalDebateScore).not.toHaveBeenCalled();
    });

    it('rejects a missing AI analysis result', async () => {
        const repo = makeRepoMock();
        const service = makeService(repo);
        vi.mocked(repo.findDebateById).mockResolvedValue(debateRow());
        vi.mocked(repo.findAiAnalysisResultByDebateId).mockResolvedValue(undefined);

        const error = await rpcErrorOf(() =>
            service.computeFinalDebateScore({ debateId: 'debate-1' }),
        );

        expect(error.code).toBe(status.FAILED_PRECONDITION);
        expect(repo.upsertFinalDebateScore).not.toHaveBeenCalled();
    });

    it('rejects a FAILED AI analysis result', async () => {
        const repo = makeRepoMock();
        const service = makeService(repo);
        vi.mocked(repo.findDebateById).mockResolvedValue(debateRow());
        vi.mocked(repo.findAiAnalysisResultByDebateId).mockResolvedValue(
            aiResultRow({
                status: 'FAILED',
                for_score: null,
                against_score: null,
            }),
        );

        const error = await rpcErrorOf(() =>
            service.computeFinalDebateScore({ debateId: 'debate-1' }),
        );

        expect(error.code).toBe(status.FAILED_PRECONDITION);
        expect(repo.upsertFinalDebateScore).not.toHaveBeenCalled();
    });

    it('rejects an incoherent COMPLETED AI analysis result', async () => {
        const repo = makeRepoMock();
        const service = makeService(repo);
        vi.mocked(repo.findDebateById).mockResolvedValue(debateRow());
        vi.mocked(repo.findAiAnalysisResultByDebateId).mockResolvedValue(
            aiResultRow({ for_score: null }),
        );

        const error = await rpcErrorOf(() =>
            service.computeFinalDebateScore({ debateId: 'debate-1' }),
        );

        expect(error.code).toBe(status.FAILED_PRECONDITION);
        expect(repo.upsertFinalDebateScore).not.toHaveBeenCalled();
    });

    it('gets a stored final score', async () => {
        const repo = makeRepoMock();
        const service = makeService(repo);
        vi.mocked(repo.findFinalDebateScoreByDebateId).mockResolvedValue(
            finalScoreRow(),
        );

        const result = await service.getFinalDebateScore({ debateId: 'debate-1' });

        expect(repo.findFinalDebateScoreByDebateId).toHaveBeenCalledWith('debate-1');
        expect(result.finalForScore).toBe(70);
        expect(result.finalAgainstScore).toBe(30);
    });

    it('returns NOT_FOUND when no final score exists', async () => {
        const repo = makeRepoMock();
        const service = makeService(repo);
        vi.mocked(repo.findFinalDebateScoreByDebateId).mockResolvedValue(undefined);

        const error = await rpcErrorOf(() =>
            service.getFinalDebateScore({ debateId: 'debate-1' }),
        );

        expect(error.code).toBe(status.NOT_FOUND);
    });
});

describe('ScoringService random recent debates for voting', () => {
    it('returns a recent votable debate candidate', async () => {
        const repo = makeRepoMock();
        const service = makeService(repo);
        vi.mocked(repo.findRecentDebatesForVoting).mockResolvedValue([
            recentDebateCandidate(),
        ]);

        const result = await service.getRandomRecentDebateForVoting({});

        expect(result).toEqual({
            debateId: 'debate-1',
            status: 'VOTING',
            voteCount: 2,
            referenceTime: '2026-01-01T00:15:00.000Z',
        });
    });

    it('applies default maxAgeMinutes and candidatePoolSize', async () => {
        const repo = makeRepoMock();
        const service = makeService(repo);
        const now = new Date('2026-01-01T00:20:00Z').getTime();
        vi.spyOn(Date, 'now').mockReturnValue(now);
        vi.mocked(repo.findRecentDebatesForVoting).mockResolvedValue([
            recentDebateCandidate(),
        ]);

        await service.getRandomRecentDebateForVoting({});

        expect(repo.findRecentDebatesForVoting).toHaveBeenCalledWith({
            cutoff: new Date('2026-01-01T00:00:00Z'),
            limit: 5,
            statuses: ['RUNNING', 'VOTING'],
        });
    });

    it('passes custom maxAgeMinutes and candidatePoolSize', async () => {
        const repo = makeRepoMock();
        const service = makeService(repo);
        const now = new Date('2026-01-01T00:20:00Z').getTime();
        vi.spyOn(Date, 'now').mockReturnValue(now);
        vi.mocked(repo.findRecentDebatesForVoting).mockResolvedValue([
            recentDebateCandidate(),
        ]);

        await service.getRandomRecentDebateForVoting({
            maxAgeMinutes: 10,
            candidatePoolSize: 3,
        });

        expect(repo.findRecentDebatesForVoting).toHaveBeenCalledWith({
            cutoff: new Date('2026-01-01T00:10:00Z'),
            limit: 3,
            statuses: ['RUNNING', 'VOTING'],
        });
    });

    it('returns NOT_FOUND if no candidate exists', async () => {
        const repo = makeRepoMock();
        const service = makeService(repo);
        vi.mocked(repo.findRecentDebatesForVoting).mockResolvedValue([]);

        const error = await rpcErrorOf(() =>
            service.getRandomRecentDebateForVoting({}),
        );

        expect(error.code).toBe(status.NOT_FOUND);
    });

    it('chooses randomly within the least-voted candidate pool returned by repository', async () => {
        const repo = makeRepoMock();
        const service = makeService(repo);
        vi.spyOn(Math, 'random').mockReturnValue(0.75);
        vi.mocked(repo.findRecentDebatesForVoting).mockResolvedValue([
            recentDebateCandidate({ debateId: 'debate-1', voteCount: 0 }),
            recentDebateCandidate({ debateId: 'debate-2', voteCount: 1 }),
            recentDebateCandidate({ debateId: 'debate-3', voteCount: 1 }),
        ]);

        const result = await service.getRandomRecentDebateForVoting({
            candidatePoolSize: 3,
        });

        expect(result.debateId).toBe('debate-3');
    });

    it('rejects invalid maxAgeMinutes', async () => {
        const repo = makeRepoMock();
        const service = makeService(repo);

        const error = await rpcErrorOf(() =>
            service.getRandomRecentDebateForVoting({ maxAgeMinutes: 0 }),
        );

        expect(error.code).toBe(status.INVALID_ARGUMENT);
        expect(repo.findRecentDebatesForVoting).not.toHaveBeenCalled();
    });

    it('rejects invalid candidatePoolSize', async () => {
        const repo = makeRepoMock();
        const service = makeService(repo);

        const error = await rpcErrorOf(() =>
            service.getRandomRecentDebateForVoting({ candidatePoolSize: 101 }),
        );

        expect(error.code).toBe(status.INVALID_ARGUMENT);
        expect(repo.findRecentDebatesForVoting).not.toHaveBeenCalled();
    });
});

describe('storeAiAnalysisResultSchema', () => {
    const completed = {
        debateId: 'debate-1',
        status: 'COMPLETED',
        summary: 'FOR had stronger evidence.',
        forScore: 72,
        againstScore: 28,
        forFeedback: 'Clear argumentation.',
        againstFeedback: 'Needs more evidence.',
    } as const;

    it('accepts a valid COMPLETED payload', () => {
        expect(storeAiAnalysisResultSchema.safeParse(completed).success).toBe(true);
    });

    it('rejects COMPLETED without summary', () => {
        const { summary: _summary, ...payload } = completed;
        expect(storeAiAnalysisResultSchema.safeParse(payload).success).toBe(false);
    });

    it('rejects COMPLETED without forScore', () => {
        const { forScore: _forScore, ...payload } = completed;
        expect(storeAiAnalysisResultSchema.safeParse(payload).success).toBe(false);
    });

    it('rejects COMPLETED without againstScore', () => {
        const { againstScore: _againstScore, ...payload } = completed;
        expect(storeAiAnalysisResultSchema.safeParse(payload).success).toBe(false);
    });

    it('rejects COMPLETED without forFeedback', () => {
        const { forFeedback: _forFeedback, ...payload } = completed;
        expect(storeAiAnalysisResultSchema.safeParse(payload).success).toBe(false);
    });

    it('rejects COMPLETED without againstFeedback', () => {
        const { againstFeedback: _againstFeedback, ...payload } = completed;
        expect(storeAiAnalysisResultSchema.safeParse(payload).success).toBe(false);
    });

    it('rejects score lower than 0', () => {
        expect(
            storeAiAnalysisResultSchema.safeParse({
                ...completed,
                forScore: -1,
            }).success,
        ).toBe(false);
    });

    it('rejects score greater than 100', () => {
        expect(
            storeAiAnalysisResultSchema.safeParse({
                ...completed,
                againstScore: 101,
            }).success,
        ).toBe(false);
    });

    it('accepts FAILED with errorMessage', () => {
        expect(
            storeAiAnalysisResultSchema.safeParse({
                debateId: 'debate-1',
                status: 'FAILED',
                errorMessage: 'OpenRouter unavailable',
            }).success,
        ).toBe(true);
    });

    it('rejects FAILED without errorMessage', () => {
        expect(
            storeAiAnalysisResultSchema.safeParse({
                debateId: 'debate-1',
                status: 'FAILED',
            }).success,
        ).toBe(false);
    });

    it('rejects an empty debateId', () => {
        expect(
            storeAiAnalysisResultSchema.safeParse({
                ...completed,
                debateId: '   ',
            }).success,
        ).toBe(false);
    });
});

describe('getAiAnalysisResultSchema', () => {
    it('rejects an empty debateId', () => {
        expect(
            getAiAnalysisResultSchema.safeParse({ debateId: '   ' }).success,
        ).toBe(false);
    });
});

describe('final debate score schemas', () => {
    it('rejects an empty compute debateId', () => {
        expect(
            computeFinalDebateScoreSchema.safeParse({ debateId: '   ' }).success,
        ).toBe(false);
    });

    it('rejects an empty get debateId', () => {
        expect(
            getFinalDebateScoreSchema.safeParse({ debateId: '   ' }).success,
        ).toBe(false);
    });
});

describe('getRandomRecentDebateForVotingSchema', () => {
    it('applies defaults', () => {
        expect(getRandomRecentDebateForVotingSchema.parse({})).toEqual({
            maxAgeMinutes: 20,
            candidatePoolSize: 5,
        });
    });

    it('rejects maxAgeMinutes lower than 1', () => {
        expect(
            getRandomRecentDebateForVotingSchema.safeParse({
                maxAgeMinutes: 0,
            }).success,
        ).toBe(false);
    });

    it('rejects maxAgeMinutes greater than 1440', () => {
        expect(
            getRandomRecentDebateForVotingSchema.safeParse({
                maxAgeMinutes: 1441,
            }).success,
        ).toBe(false);
    });

    it('rejects candidatePoolSize lower than 1', () => {
        expect(
            getRandomRecentDebateForVotingSchema.safeParse({
                candidatePoolSize: 0,
            }).success,
        ).toBe(false);
    });

    it('rejects candidatePoolSize greater than 100', () => {
        expect(
            getRandomRecentDebateForVotingSchema.safeParse({
                candidatePoolSize: 101,
            }).success,
        ).toBe(false);
    });
});

describe('ScoringRepository AI analysis result queries', () => {
    it('upsertAiAnalysisResult inserts a new result', async () => {
        const row = aiResultRow();
        const captured: { values?: unknown } = {};
        const db = {
            insertInto: vi.fn(() => ({
                values: vi.fn((values: unknown) => {
                    captured.values = values;
                    return {
                        onConflict: vi.fn(() => ({
                            returningAll: vi.fn(() => ({
                                executeTakeFirstOrThrow: vi.fn().mockResolvedValue(row),
                            })),
                        })),
                    };
                }),
            })),
        } as unknown as Kysely<Database>;
        const repo = new ScoringRepository(db);

        await expect(
            repo.upsertAiAnalysisResult({
                debateId: 'debate-1',
                status: 'COMPLETED',
                summary: 'Summary',
                forScore: 60,
                againstScore: 40,
                forFeedback: 'FOR feedback',
                againstFeedback: 'AGAINST feedback',
            }),
        ).resolves.toBe(row);

        expect(db.insertInto).toHaveBeenCalledWith('debate_ai_analysis_results');
        expect(captured.values).toMatchObject({
            debate_id: 'debate-1',
            status: 'COMPLETED',
            for_score: 60,
            against_score: 40,
        });
    });

    it('upsertAiAnalysisResult updates an existing result on conflict', async () => {
        let updateSet: unknown;
        const db = {
            insertInto: vi.fn(() => ({
                values: vi.fn(() => ({
                    onConflict: vi.fn((callback: (oc: unknown) => unknown) => {
                        const oc = {
                            column: vi.fn(() => ({
                                doUpdateSet: vi.fn((set: unknown) => {
                                    updateSet = set;
                                    return set;
                                }),
                            })),
                        };
                        callback(oc);
                        return {
                            returningAll: vi.fn(() => ({
                                executeTakeFirstOrThrow: vi.fn().mockResolvedValue(aiResultRow()),
                            })),
                        };
                    }),
                })),
            })),
        } as unknown as Kysely<Database>;
        const repo = new ScoringRepository(db);

        await repo.upsertAiAnalysisResult({
            debateId: 'debate-1',
            status: 'FAILED',
            errorMessage: 'OpenRouter unavailable',
        });

        expect(updateSet).toMatchObject({
            status: 'FAILED',
            summary: null,
            for_score: null,
            against_score: null,
            error_message: 'OpenRouter unavailable',
        });
        expect(updateSet).toHaveProperty('updated_at');
    });

    it('findAiAnalysisResultByDebateId filters by debateId', async () => {
        const row = aiResultRow();
        const captured: { where?: unknown[] } = {};
        const db = {
            selectFrom: vi.fn(() => ({
                selectAll: vi.fn(() => ({
                    where: vi.fn((...args: unknown[]) => {
                        captured.where = args;
                        return {
                            executeTakeFirst: vi.fn().mockResolvedValue(row),
                        };
                    }),
                })),
            })),
        } as unknown as Kysely<Database>;
        const repo = new ScoringRepository(db);

        await expect(repo.findAiAnalysisResultByDebateId('debate-1')).resolves.toBe(row);

        expect(db.selectFrom).toHaveBeenCalledWith('debate_ai_analysis_results');
        expect(captured.where).toEqual(['debate_id', '=', 'debate-1']);
    });
});

describe('ScoringRepository final score queries', () => {
    it('upsertFinalDebateScore inserts a new result', async () => {
        const row = finalScoreRow();
        const captured: { values?: unknown } = {};
        const db = {
            insertInto: vi.fn(() => ({
                values: vi.fn((values: unknown) => {
                    captured.values = values;
                    return {
                        onConflict: vi.fn(() => ({
                            returningAll: vi.fn(() => ({
                                executeTakeFirstOrThrow: vi.fn().mockResolvedValue(row),
                            })),
                        })),
                    };
                }),
            })),
        } as unknown as Kysely<Database>;
        const repo = new ScoringRepository(db);

        await expect(
            repo.upsertFinalDebateScore({
                debateId: 'debate-1',
                aiForScore: 80,
                aiAgainstScore: 20,
                audienceForScore: 60,
                audienceAgainstScore: 40,
                finalForScore: 70,
                finalAgainstScore: 30,
                winnerSide: 'FOR',
            }),
        ).resolves.toBe(row);

        expect(db.insertInto).toHaveBeenCalledWith('debate_final_scores');
        expect(captured.values).toMatchObject({
            debate_id: 'debate-1',
            ai_for_score: 80,
            final_for_score: 70,
            winner_side: 'FOR',
        });
    });

    it('upsertFinalDebateScore updates an existing result on conflict', async () => {
        let updateSet: unknown;
        const db = {
            insertInto: vi.fn(() => ({
                values: vi.fn(() => ({
                    onConflict: vi.fn((callback: (oc: unknown) => unknown) => {
                        const oc = {
                            column: vi.fn(() => ({
                                doUpdateSet: vi.fn((set: unknown) => {
                                    updateSet = set;
                                    return set;
                                }),
                            })),
                        };
                        callback(oc);
                        return {
                            returningAll: vi.fn(() => ({
                                executeTakeFirstOrThrow: vi.fn().mockResolvedValue(
                                    finalScoreRow(),
                                ),
                            })),
                        };
                    }),
                })),
            })),
        } as unknown as Kysely<Database>;
        const repo = new ScoringRepository(db);

        await repo.upsertFinalDebateScore({
            debateId: 'debate-1',
            aiForScore: 50,
            aiAgainstScore: 50,
            audienceForScore: 50,
            audienceAgainstScore: 50,
            finalForScore: 50,
            finalAgainstScore: 50,
            winnerSide: 'DRAW',
        });

        expect(updateSet).toMatchObject({
            ai_for_score: 50,
            ai_against_score: 50,
            final_for_score: 50,
            final_against_score: 50,
            winner_side: 'DRAW',
        });
        expect(updateSet).toHaveProperty('updated_at');
    });

    it('findFinalDebateScoreByDebateId filters by debateId', async () => {
        const row = finalScoreRow();
        const captured: { where?: unknown[] } = {};
        const db = {
            selectFrom: vi.fn(() => ({
                selectAll: vi.fn(() => ({
                    where: vi.fn((...args: unknown[]) => {
                        captured.where = args;
                        return {
                            executeTakeFirst: vi.fn().mockResolvedValue(row),
                        };
                    }),
                })),
            })),
        } as unknown as Kysely<Database>;
        const repo = new ScoringRepository(db);

        await expect(repo.findFinalDebateScoreByDebateId('debate-1')).resolves.toBe(
            row,
        );

        expect(db.selectFrom).toHaveBeenCalledWith('debate_final_scores');
        expect(captured.where).toEqual(['debate_id', '=', 'debate-1']);
    });
});

describe('ScoringRepository recent debate voting candidates', () => {
    it('filters votable recent debates, counts votes, orders by fewest votes, and limits the pool', async () => {
        const cutoff = new Date('2026-01-01T00:00:00Z');
        const rows = [
            {
                debate_id: 'debate-1',
                status: 'VOTING',
                vote_count: 1,
                reference_time: new Date('2026-01-01T00:10:00Z'),
            },
        ];
        const captured: {
            where: unknown[][];
            groupBy?: unknown;
            orderBy: unknown[][];
            limit?: number;
        } = { where: [], orderBy: [] };
        const chain = {
            leftJoin: vi.fn(() => chain),
            select: vi.fn(() => chain),
            where: vi.fn((...args: unknown[]) => {
                captured.where.push(args);
                return chain;
            }),
            groupBy: vi.fn((args: unknown) => {
                captured.groupBy = args;
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
            execute: vi.fn().mockResolvedValue(rows),
        };
        const db = {
            selectFrom: vi.fn(() => chain),
        } as unknown as Kysely<Database>;
        const repo = new ScoringRepository(db);

        await expect(
            repo.findRecentDebatesForVoting({
                cutoff,
                limit: 5,
                statuses: ['RUNNING', 'VOTING'],
            }),
        ).resolves.toEqual([
            {
                debateId: 'debate-1',
                status: 'VOTING',
                voteCount: 1,
                referenceTime: new Date('2026-01-01T00:10:00Z'),
            },
        ]);

        expect(db.selectFrom).toHaveBeenCalledWith('debates');
        expect(chain.leftJoin).toHaveBeenCalledWith(
            'spectator_votes',
            'spectator_votes.debate_id',
            'debates.id',
        );
        expect(captured.where).toEqual([
            ['debates.status', 'in', ['RUNNING', 'VOTING']],
            ['debates.updated_at', '>=', cutoff],
        ]);
        expect(captured.groupBy).toEqual([
            'debates.id',
            'debates.status',
            'debates.updated_at',
        ]);
        expect(captured.orderBy).toHaveLength(2);
        expect(captured.orderBy[0]?.[1]).toBe('asc');
        expect(captured.orderBy[1]).toEqual(['debates.id', 'asc']);
        expect(captured.limit).toBe(5);
    });
});

describe('ScoringService debate upsert', () => {
    it('enqueues finalization when a debate transitions into VOTING', async () => {
        const repo = makeRepoMock();
        const producer = makeProducerMock();
        const service = makeService(repo, producer);
        vi.mocked(repo.findDebateById).mockResolvedValue(
            debateRow({ status: 'RUNNING' }),
        );
        vi.mocked(repo.upsertDebate).mockResolvedValue(
            debateRow({ status: 'VOTING' }),
        );

        await service.upsertDebate({ debateId: 'debate-1', status: 'VOTING' });

        expect(producer.enqueueFinalization).toHaveBeenCalledOnce();
        expect(producer.enqueueFinalization).toHaveBeenCalledWith('debate-1', '');
    });

    it('enqueues finalization for a brand-new debate created directly in VOTING', async () => {
        const repo = makeRepoMock();
        const producer = makeProducerMock();
        const service = makeService(repo, producer);
        vi.mocked(repo.findDebateById).mockResolvedValue(undefined);
        vi.mocked(repo.upsertDebate).mockResolvedValue(
            debateRow({ status: 'VOTING' }),
        );

        await service.upsertDebate({ debateId: 'debate-1', status: 'VOTING' });

        expect(producer.enqueueFinalization).toHaveBeenCalledOnce();
    });

    it('does not enqueue when the debate is already VOTING', async () => {
        const repo = makeRepoMock();
        const producer = makeProducerMock();
        const service = makeService(repo, producer);
        vi.mocked(repo.findDebateById).mockResolvedValue(
            debateRow({ status: 'VOTING' }),
        );
        vi.mocked(repo.upsertDebate).mockResolvedValue(
            debateRow({ status: 'VOTING' }),
        );

        await service.upsertDebate({ debateId: 'debate-1', status: 'VOTING' });

        expect(producer.enqueueFinalization).not.toHaveBeenCalled();
    });

    it('does not enqueue for a non-VOTING transition', async () => {
        const repo = makeRepoMock();
        const producer = makeProducerMock();
        const service = makeService(repo, producer);
        vi.mocked(repo.findDebateById).mockResolvedValue(undefined);
        vi.mocked(repo.upsertDebate).mockResolvedValue(
            debateRow({ status: 'RUNNING' }),
        );

        await service.upsertDebate({ debateId: 'debate-1', status: 'RUNNING' });

        expect(producer.enqueueFinalization).not.toHaveBeenCalled();
    });
});
