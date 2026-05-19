import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    BadRequestException,
    ConflictException,
    NotFoundException,
} from '@nestjs/common';
import { DebateStatus } from '../debates/debate.model';
import { ScoringController } from '../scoring/scoring.controller';
import { InMemoryScoringRepository } from '../scoring/in-memory-scoring.repository';
import { SpectatorVoteSide } from './spectator-vote.model';
import { SpectatorVotesService } from './spectator-votes.service';

function createFixture() {
    const repository = new InMemoryScoringRepository();
    const service = new SpectatorVotesService(repository);
    const controller = new ScoringController(service, repository);
    return { controller, repository, service };
}

describe('SpectatorVotesService', () => {
    it('creates a vote while debate is RUNNING', async () => {
        const { repository, service } = createFixture();
        repository.seedDebate({ id: 'debate-running', status: DebateStatus.Running });

        const vote = await service.createVote({
            debateId: 'debate-running',
            userId: 'user-1',
            side: SpectatorVoteSide.For,
        });

        assert.equal(vote.debateId, 'debate-running');
        assert.equal(vote.userId, 'user-1');
        assert.equal(vote.side, SpectatorVoteSide.For);
    });

    it('creates a vote while debate is VOTING', async () => {
        const { repository, service } = createFixture();
        repository.seedDebate({ id: 'debate-voting', status: DebateStatus.Voting });

        const vote = await service.createVote({
            debateId: 'debate-voting',
            userId: 'user-1',
            side: SpectatorVoteSide.Against,
        });

        assert.equal(vote.debateId, 'debate-voting');
        assert.equal(vote.side, SpectatorVoteSide.Against);
    });

    it('rejects a vote when debate is CLOSED', async () => {
        const { repository, service } = createFixture();
        repository.seedDebate({ id: 'debate-closed', status: DebateStatus.Closed });

        await assert.rejects(
            service.createVote({
                debateId: 'debate-closed',
                userId: 'user-1',
                side: SpectatorVoteSide.For,
            }),
            ConflictException,
        );
    });

    it('rejects a vote when debate is in another non-votable state', async () => {
        const { repository, service } = createFixture();
        repository.seedDebate({ id: 'debate-pending', status: DebateStatus.Pending });

        await assert.rejects(
            service.createVote({
                debateId: 'debate-pending',
                userId: 'user-1',
                side: SpectatorVoteSide.For,
            }),
            ConflictException,
        );
    });

    it('rejects an invalid side', async () => {
        const { repository, service } = createFixture();
        repository.seedDebate({ id: 'debate-running', status: DebateStatus.Running });

        await assert.rejects(
            service.createVote({
                debateId: 'debate-running',
                userId: 'user-1',
                side: 'PRO',
            }),
            BadRequestException,
        );
    });

    it('rejects a vote on an unknown debate', async () => {
        const { service } = createFixture();

        await assert.rejects(
            service.createVote({
                debateId: 'missing-debate',
                userId: 'user-1',
                side: SpectatorVoteSide.For,
            }),
            NotFoundException,
        );
    });

    it('rejects a second vote by the same user on the same debate', async () => {
        const { repository, service } = createFixture();
        repository.seedDebate({ id: 'debate-running', status: DebateStatus.Running });

        await service.createVote({
            debateId: 'debate-running',
            userId: 'user-1',
            side: SpectatorVoteSide.For,
        });

        await assert.rejects(
            service.createVote({
                debateId: 'debate-running',
                userId: 'user-1',
                side: SpectatorVoteSide.Against,
            }),
            ConflictException,
        );
    });

    it('allows two different users to vote on the same debate', async () => {
        const { repository, service } = createFixture();
        repository.seedDebate({ id: 'debate-running', status: DebateStatus.Running });

        const firstVote = await service.createVote({
            debateId: 'debate-running',
            userId: 'user-1',
            side: SpectatorVoteSide.For,
        });
        const secondVote = await service.createVote({
            debateId: 'debate-running',
            userId: 'user-2',
            side: SpectatorVoteSide.Against,
        });

        assert.equal(firstVote.userId, 'user-1');
        assert.equal(secondVote.userId, 'user-2');
    });

    it('allows the same user to vote on two different debates', async () => {
        const { repository, service } = createFixture();
        repository.seedDebate({ id: 'first-debate', status: DebateStatus.Running });
        repository.seedDebate({ id: 'second-debate', status: DebateStatus.Voting });

        const firstVote = await service.createVote({
            debateId: 'first-debate',
            userId: 'user-1',
            side: SpectatorVoteSide.For,
        });
        const secondVote = await service.createVote({
            debateId: 'second-debate',
            userId: 'user-1',
            side: SpectatorVoteSide.Against,
        });

        assert.equal(firstVote.debateId, 'first-debate');
        assert.equal(secondVote.debateId, 'second-debate');
        assert.equal(firstVote.userId, secondVote.userId);
    });

    it('creates a vote after a debate is upserted through the runtime TCP handler', async () => {
        const { controller, service } = createFixture();

        const debate = await controller.upsertDebate({
            debateId: 'runtime-debate',
            status: DebateStatus.Running,
        });
        const vote = await service.createVote({
            debateId: 'runtime-debate',
            userId: 'user-1',
            side: SpectatorVoteSide.For,
        });

        assert.equal(debate.id, 'runtime-debate');
        assert.equal(debate.status, DebateStatus.Running);
        assert.equal(vote.debateId, 'runtime-debate');
    });
});
