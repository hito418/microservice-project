import { status } from '@grpc/grpc-js';
import { RpcException } from '@nestjs/microservices';
import {
    audienceVoteSummarySchema,
    createSpectatorVoteSchema,
} from '@contracts/scoring';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DebateRow, SpectatorVoteRow } from '../db/database.types';
import {
    DuplicateSpectatorVoteError,
    ScoringRepository,
} from '../scoring/scoring.repository';
import { SpectatorVotesService } from './spectator-votes.service';

function makeRepoMock(): ScoringRepository {
    return {
        findDebateById: vi.fn(),
        upsertDebate: vi.fn(),
        findVoteByDebateAndUser: vi.fn(),
        createSpectatorVote: vi.fn(),
        countSpectatorVotesBySide: vi.fn(),
    } as unknown as ScoringRepository;
}

function voteRow(overrides: Partial<SpectatorVoteRow> = {}): SpectatorVoteRow {
    return {
        id: 'vote-1',
        debate_id: 'debate-1',
        user_id: 'user-1',
        side: 'FOR',
        created_at: new Date('2026-01-01T00:00:00Z'),
        ...overrides,
    };
}

function debateRow(overrides: Partial<DebateRow> = {}): DebateRow {
    return {
        id: 'debate-1',
        status: 'RUNNING',
        created_at: new Date('2026-01-01T00:00:00Z'),
        updated_at: new Date('2026-01-01T00:00:00Z'),
        ...overrides,
    };
}

describe('SpectatorVotesService.createVote', () => {
    let repo: ScoringRepository;
    let service: SpectatorVotesService;

    beforeEach(() => {
        repo = makeRepoMock();
        service = new SpectatorVotesService(repo);
    });

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

    it('creates a vote and maps the row to a proto response', async () => {
        vi.mocked(repo.findDebateById).mockResolvedValue(debateRow());
        vi.mocked(repo.findVoteByDebateAndUser).mockResolvedValue(undefined);
        vi.mocked(repo.createSpectatorVote).mockResolvedValue(voteRow());

        const result = await service.createVote(
            { debateId: 'debate-1', side: 'FOR' },
            'user-1',
        );

        expect(repo.createSpectatorVote).toHaveBeenCalledWith({
            debateId: 'debate-1',
            userId: 'user-1',
            side: 'FOR',
        });
        expect(result).toEqual({
            id: 'vote-1',
            debateId: 'debate-1',
            userId: 'user-1',
            side: 'FOR',
            createdAt: '2026-01-01T00:00:00.000Z',
        });
    });

    it('rejects an unknown debate with NOT_FOUND', async () => {
        vi.mocked(repo.findDebateById).mockResolvedValue(undefined);

        const error = await rpcErrorOf(() =>
            service.createVote({ debateId: 'missing', side: 'FOR' }, 'user-1'),
        );

        expect(error.code).toBe(status.NOT_FOUND);
        expect(repo.createSpectatorVote).not.toHaveBeenCalled();
    });

    it('rejects a non-votable debate with FAILED_PRECONDITION', async () => {
        vi.mocked(repo.findDebateById).mockResolvedValue(
            debateRow({ status: 'CLOSED' }),
        );

        const error = await rpcErrorOf(() =>
            service.createVote({ debateId: 'debate-1', side: 'FOR' }, 'user-1'),
        );

        expect(error.code).toBe(status.FAILED_PRECONDITION);
    });

    it('rejects a duplicate vote (pre-check) with ALREADY_EXISTS', async () => {
        vi.mocked(repo.findDebateById).mockResolvedValue(debateRow());
        vi.mocked(repo.findVoteByDebateAndUser).mockResolvedValue(voteRow());

        const error = await rpcErrorOf(() =>
            service.createVote({ debateId: 'debate-1', side: 'AGAINST' }, 'user-1'),
        );

        expect(error.code).toBe(status.ALREADY_EXISTS);
        expect(repo.createSpectatorVote).not.toHaveBeenCalled();
    });

    it('translates a unique-violation race on insert to ALREADY_EXISTS', async () => {
        vi.mocked(repo.findDebateById).mockResolvedValue(debateRow());
        vi.mocked(repo.findVoteByDebateAndUser).mockResolvedValue(undefined);
        vi.mocked(repo.createSpectatorVote).mockRejectedValue(
            new DuplicateSpectatorVoteError('debate-1', 'user-1'),
        );

        const error = await rpcErrorOf(() =>
            service.createVote({ debateId: 'debate-1', side: 'FOR' }, 'user-1'),
        );

        expect(error.code).toBe(status.ALREADY_EXISTS);
    });
});

describe('createSpectatorVoteSchema', () => {
    it('accepts and trims a valid payload', () => {
        const result = createSpectatorVoteSchema.safeParse({
            debateId: '  debate-1 ',
            side: 'FOR',
        });

        expect(result.success).toBe(true);
        expect(result.success && result.data).toEqual({
            debateId: 'debate-1',
            side: 'FOR',
        });
    });

    it('rejects an unknown side', () => {
        const result = createSpectatorVoteSchema.safeParse({
            debateId: 'debate-1',
            side: 'PRO',
        });

        expect(result.success).toBe(false);
    });

    it('rejects a blank debateId', () => {
        const result = createSpectatorVoteSchema.safeParse({
            debateId: '   ',
            side: 'FOR',
        });

        expect(result.success).toBe(false);
    });
});

describe('SpectatorVotesService.getSummary', () => {
    let repo: ScoringRepository;
    let service: SpectatorVotesService;

    beforeEach(() => {
        repo = makeRepoMock();
        service = new SpectatorVotesService(repo);
    });

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

    function knownDebate(): void {
        vi.mocked(repo.findDebateById).mockResolvedValue(debateRow());
    }

    it('returns zero counts and scores for a known debate without votes', async () => {
        knownDebate();
        vi.mocked(repo.countSpectatorVotesBySide).mockResolvedValue([]);

        await expect(service.getSummary({ debateId: 'debate-1' })).resolves.toEqual({
            debateId: 'debate-1',
            totalVotes: 0,
            forVotes: 0,
            againstVotes: 0,
            forScore: 0,
            againstScore: 0,
        });
    });

    it('scores one FOR vote as 100/0', async () => {
        knownDebate();
        vi.mocked(repo.countSpectatorVotesBySide).mockResolvedValue([
            { side: 'FOR', votes: 1 },
        ]);

        await expect(service.getSummary({ debateId: 'debate-1' })).resolves.toMatchObject({
            totalVotes: 1,
            forVotes: 1,
            againstVotes: 0,
            forScore: 100,
            againstScore: 0,
        });
    });

    it('scores one AGAINST vote as 0/100', async () => {
        knownDebate();
        vi.mocked(repo.countSpectatorVotesBySide).mockResolvedValue([
            { side: 'AGAINST', votes: 1 },
        ]);

        await expect(service.getSummary({ debateId: 'debate-1' })).resolves.toMatchObject({
            totalVotes: 1,
            forVotes: 0,
            againstVotes: 1,
            forScore: 0,
            againstScore: 100,
        });
    });

    it('scores one FOR and one AGAINST vote as 50/50', async () => {
        knownDebate();
        vi.mocked(repo.countSpectatorVotesBySide).mockResolvedValue([
            { side: 'FOR', votes: 1 },
            { side: 'AGAINST', votes: 1 },
        ]);

        await expect(service.getSummary({ debateId: 'debate-1' })).resolves.toMatchObject({
            totalVotes: 2,
            forVotes: 1,
            againstVotes: 1,
            forScore: 50,
            againstScore: 50,
        });
    });

    it('rounds two FOR and one AGAINST votes as 67/33', async () => {
        knownDebate();
        vi.mocked(repo.countSpectatorVotesBySide).mockResolvedValue([
            { side: 'FOR', votes: 2 },
            { side: 'AGAINST', votes: 1 },
        ]);

        await expect(service.getSummary({ debateId: 'debate-1' })).resolves.toMatchObject({
            totalVotes: 3,
            forVotes: 2,
            againstVotes: 1,
            forScore: 67,
            againstScore: 33,
        });
    });

    it('delegates debate isolation to the repository filter', async () => {
        knownDebate();
        vi.mocked(repo.countSpectatorVotesBySide).mockResolvedValue([
            { side: 'FOR', votes: 1 },
        ]);

        await service.getSummary({ debateId: 'debate-1' });

        expect(repo.countSpectatorVotesBySide).toHaveBeenCalledWith('debate-1');
    });

    it('rejects an unknown debate with NOT_FOUND', async () => {
        vi.mocked(repo.findDebateById).mockResolvedValue(undefined);

        const error = await rpcErrorOf(() =>
            service.getSummary({ debateId: 'missing' }),
        );

        expect(error.code).toBe(status.NOT_FOUND);
        expect(repo.countSpectatorVotesBySide).not.toHaveBeenCalled();
    });
});

describe('audienceVoteSummarySchema', () => {
    it('accepts and trims a valid debateId', () => {
        const result = audienceVoteSummarySchema.safeParse({
            debateId: '  debate-1 ',
        });

        expect(result.success).toBe(true);
        expect(result.success && result.data).toEqual({ debateId: 'debate-1' });
    });

    it('rejects a blank debateId', () => {
        const result = audienceVoteSummarySchema.safeParse({
            debateId: '   ',
        });

        expect(result.success).toBe(false);
    });
});
