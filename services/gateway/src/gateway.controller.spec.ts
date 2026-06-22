import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BadRequestException } from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import type { Metadata } from '@grpc/grpc-js';
import { readUserMetadata } from '@repo/common/grpc';
import { of } from 'rxjs';
import type {
    CreateSpectatorVoteRequest,
    ScoringServiceClient,
    SpectatorVoteResponse,
} from '@contracts/scoring';
import type { AuthenticatedUser } from './auth/authenticated-user';
import { GatewayController } from './gateway.controller';
import type { CreateSpectatorVoteDto } from './votes/create-spectator-vote.dto';

function createController(
    onCreate: (
        request: CreateSpectatorVoteRequest,
        metadata: Metadata,
    ) => SpectatorVoteResponse,
): GatewayController {
    const scoring: Pick<ScoringServiceClient, 'createSpectatorVote'> = {
        createSpectatorVote: (request, metadata) =>
            of(onCreate(request, metadata as Metadata)),
    };
    const client = {
        getService: () => scoring,
    } as unknown as ClientGrpc;
    const controller = new GatewayController(client);
    controller.onModuleInit();
    return controller;
}

describe('GatewayController spectator votes', () => {
    it('rejects a missing body with 400 before calling scoring', async () => {
        let scoringCalled = false;
        const controller = createController(() => {
            scoringCalled = true;
            return {} as SpectatorVoteResponse;
        });

        await assert.rejects(
            controller.createSpectatorVote('debate-1', undefined, {
                id: 'user-1',
                role: 'user',
            }),
            BadRequestException,
        );
        assert.equal(scoringCalled, false);
    });

    it('takes debateId from the URL and forwards the user as gRPC metadata', async () => {
        let received: CreateSpectatorVoteRequest | undefined;
        let principal: ReturnType<typeof readUserMetadata> = null;
        const user: AuthenticatedUser = { id: 'header-user', role: 'user' };
        const body = { side: 'FOR' } as CreateSpectatorVoteDto;
        const controller = createController((request, metadata) => {
            received = request;
            principal = readUserMetadata(metadata);
            return {
                id: 'vote-1',
                debateId: 'url-debate',
                userId: 'header-user',
                side: 'FOR',
                createdAt: new Date().toISOString(),
            };
        });

        const result = await controller.createSpectatorVote('url-debate', body, user);

        // Identity is out-of-band: the message carries only the domain fields.
        assert.deepEqual(received, { debateId: 'url-debate', side: 'FOR' });
        assert.deepEqual(principal, { id: 'header-user', role: 'user' });
        assert.equal(result.id, 'vote-1');
    });
});
