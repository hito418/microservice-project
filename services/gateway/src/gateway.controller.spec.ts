import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import type { ClientProxy } from '@nestjs/microservices';
import { of } from 'rxjs';
import type { AuthenticatedUser } from './auth/authenticated-user';
import { GatewayController } from './gateway.controller';
import type { CreateSpectatorVoteDto } from './votes/create-spectator-vote.dto';

type SentMessage = {
    pattern: unknown;
    payload: unknown;
};

function createClientProxy(onSend: (message: SentMessage) => unknown): ClientProxy {
    const proxy = {
        send: (pattern: unknown, payload: unknown) => of(onSend({ pattern, payload })),
    };
    return proxy as Pick<ClientProxy, 'send'> as ClientProxy;
}

describe('GatewayController spectator votes', () => {
    it('rejects a missing body with 400 before calling scoring', async () => {
        let scoringCalled = false;
        const controller = new GatewayController(
            createClientProxy(() => 0),
            createClientProxy(() => {
                scoringCalled = true;
                return {};
            }),
        );

        await assert.rejects(
            controller.createSpectatorVote('debate-1', undefined, { id: 'user-1' }),
            BadRequestException,
        );
        assert.equal(scoringCalled, false);
    });

    it('uses debateId from the URL and userId from the authenticated user', async () => {
        let sentMessage: SentMessage | undefined;
        const user: AuthenticatedUser = { id: 'header-user' };
        const body = {
            side: 'FOR',
            debateId: 'body-debate',
            userId: 'body-user',
        } as unknown as CreateSpectatorVoteDto;
        const controller = new GatewayController(
            createClientProxy(() => 0),
            createClientProxy((message) => {
                sentMessage = message;
                return {
                    id: 'vote-1',
                    debateId: 'url-debate',
                    userId: 'header-user',
                    side: 'FOR',
                    createdAt: new Date().toISOString(),
                };
            }),
        );

        await controller.createSpectatorVote('url-debate', body, user);

        assert.deepEqual(sentMessage?.payload, {
            debateId: 'url-debate',
            userId: 'header-user',
            side: 'FOR',
        });
    });

    it('calls scoring summary with debateId from the URL', async () => {
        let sentMessage: SentMessage | undefined;
        const expectedSummary = {
            debateId: 'url-debate',
            totalVotes: 3,
            forVotes: 2,
            againstVotes: 1,
            forScore: 67,
            againstScore: 33,
        };
        const controller = new GatewayController(
            createClientProxy(() => 0),
            createClientProxy((message) => {
                sentMessage = message;
                return expectedSummary;
            }),
        );

        const summary = await controller.getAudienceVoteSummary('url-debate');

        assert.deepEqual(sentMessage, {
            pattern: { cmd: 'scoring.audience-votes.summary' },
            payload: { debateId: 'url-debate' },
        });
        assert.deepEqual(summary, expectedSummary);
    });

    it('propagates a scoring 404 when summary debate does not exist', async () => {
        const controller = new GatewayController(
            createClientProxy(() => 0),
            createClientProxy(() => {
                throw Object.assign(new Error('Scoring debate not found'), {
                    statusCode: HttpStatus.NOT_FOUND,
                    message: 'Debate missing-debate was not found',
                });
            }),
        );

        await assert.rejects(
            controller.getAudienceVoteSummary('missing-debate'),
            (error: unknown) => {
                assert.ok(error instanceof HttpException);
                assert.equal(error.getStatus(), HttpStatus.NOT_FOUND);
                assert.deepEqual(error.getResponse(), {
                    message: 'Debate missing-debate was not found',
                });
                return true;
            },
        );
    });
});
