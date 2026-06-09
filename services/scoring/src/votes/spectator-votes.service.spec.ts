import { status } from '@grpc/grpc-js';
import { RpcException } from '@nestjs/microservices';
import { createSpectatorVoteSchema } from '@contracts/scoring';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SpectatorVoteRow } from '../db/database.types';
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
        vi.mocked(repo.findDebateById).mockResolvedValue({
            id: 'debate-1',
            status: 'RUNNING',
        });
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
        vi.mocked(repo.findDebateById).mockResolvedValue({
            id: 'debate-1',
            status: 'CLOSED',
        });

        const error = await rpcErrorOf(() =>
            service.createVote({ debateId: 'debate-1', side: 'FOR' }, 'user-1'),
        );

        expect(error.code).toBe(status.FAILED_PRECONDITION);
    });

    it('rejects a duplicate vote (pre-check) with ALREADY_EXISTS', async () => {
        vi.mocked(repo.findDebateById).mockResolvedValue({
            id: 'debate-1',
            status: 'RUNNING',
        });
        vi.mocked(repo.findVoteByDebateAndUser).mockResolvedValue(voteRow());

        const error = await rpcErrorOf(() =>
            service.createVote({ debateId: 'debate-1', side: 'AGAINST' }, 'user-1'),
        );

        expect(error.code).toBe(status.ALREADY_EXISTS);
        expect(repo.createSpectatorVote).not.toHaveBeenCalled();
    });

    it('translates a unique-violation race on insert to ALREADY_EXISTS', async () => {
        vi.mocked(repo.findDebateById).mockResolvedValue({
            id: 'debate-1',
            status: 'RUNNING',
        });
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
