import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import { status as grpcStatus, type Metadata } from '@grpc/grpc-js';
import { readUserMetadata } from '@repo/common/grpc';
import { of, throwError } from 'rxjs';
import type {
    AudienceVoteSummaryRequest,
    AudienceVoteSummaryResponse,
    CreateSpectatorVoteRequest,
    ScoringServiceClient,
    SpectatorVoteResponse,
} from '@contracts/scoring';
import type { AuthenticatedUser } from './auth/authenticated-user';
import { GatewayController } from './gateway.controller';
import type { RealtimeService } from './realtime/realtime.service';
import type { CreateSpectatorVoteDto } from './votes/create-spectator-vote.dto';

type RealtimeStub = Pick<RealtimeService, 'publishVoteCreated'>;

interface CreateControllerOptions {
    onSummary?: (
        request: AudienceVoteSummaryRequest,
    ) => AudienceVoteSummaryResponse;
    realtime?: RealtimeStub;
}

function createRealtimeStub(
    onPublish: RealtimeStub['publishVoteCreated'] = () => undefined as never,
): RealtimeStub {
    return { publishVoteCreated: onPublish };
}

function createController(
    onCreate: (
        request: CreateSpectatorVoteRequest,
        metadata: Metadata,
    ) => SpectatorVoteResponse,
    options: CreateControllerOptions = {},
): GatewayController {
    const onSummary = options.onSummary ?? (() => ({
        debateId: 'debate-1',
        totalVotes: 0,
        forVotes: 0,
        againstVotes: 0,
        forScore: 0,
        againstScore: 0,
    }));
    const realtime = options.realtime ?? createRealtimeStub();
    const scoring: Pick<
        ScoringServiceClient,
        'createSpectatorVote' | 'getAudienceVoteSummary'
    > = {
        createSpectatorVote: (request, metadata) =>
            of(onCreate(request, metadata as Metadata)),
        getAudienceVoteSummary: (request) => of(onSummary(request)),
    };
    const client = {
        getService: () => scoring,
    } as unknown as ClientGrpc;
    const controller = new GatewayController(
        client,
        realtime as RealtimeService,
    );
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
        let published: SpectatorVoteResponse | undefined;
        const user: AuthenticatedUser = { id: 'header-user', role: 'user' };
        const body = { side: 'FOR' } as CreateSpectatorVoteDto;
        const controller = createController(
            (request, metadata) => {
                received = request;
                principal = readUserMetadata(metadata);
                return {
                    id: 'vote-1',
                    debateId: 'url-debate',
                    userId: 'header-user',
                    side: 'FOR',
                    createdAt: new Date().toISOString(),
                };
            },
            {
                realtime: createRealtimeStub((vote) => {
                    published = vote;
                    return undefined as never;
                }),
            },
        );

        const result = await controller.createSpectatorVote('url-debate', body, user);

        // Identity is out-of-band: the message carries only the domain fields.
        assert.deepEqual(received, { debateId: 'url-debate', side: 'FOR' });
        assert.deepEqual(principal, { id: 'header-user', role: 'user' });
        assert.equal(result.id, 'vote-1');
        assert.equal(published, result);
    });
});

describe('GatewayController audience vote summaries', () => {
    it('takes debateId from the URL and returns the scoring summary', async () => {
        let received: AudienceVoteSummaryRequest | undefined;
        const controller = createController(
            () => ({} as SpectatorVoteResponse),
            {
                onSummary: (request) => {
                    received = request;
                    return {
                        debateId: 'url-debate',
                        totalVotes: 3,
                        forVotes: 2,
                        againstVotes: 1,
                        forScore: 67,
                        againstScore: 33,
                    };
                },
            },
        );

        const result = await controller.getAudienceVoteSummary('url-debate');

        assert.deepEqual(received, { debateId: 'url-debate' });
        assert.deepEqual(result, {
            debateId: 'url-debate',
            totalVotes: 3,
            forVotes: 2,
            againstVotes: 1,
            forScore: 67,
            againstScore: 33,
        });
    });

    it('maps scoring NOT_FOUND errors to HTTP 404', async () => {
        const scoring: Pick<
            ScoringServiceClient,
            'createSpectatorVote' | 'getAudienceVoteSummary'
        > = {
            createSpectatorVote: () => of({} as SpectatorVoteResponse),
            getAudienceVoteSummary: () =>
                throwError(() => ({ code: grpcStatus.NOT_FOUND })),
        };
        const client = { getService: () => scoring } as unknown as ClientGrpc;
        const controller = new GatewayController(
            client,
            createRealtimeStub() as RealtimeService,
        );
        controller.onModuleInit();

        await assert.rejects(
            () => controller.getAudienceVoteSummary('missing'),
            NotFoundException,
        );
    });

    it('maps scoring validation errors to HTTP 400', async () => {
        const scoring: Pick<
            ScoringServiceClient,
            'createSpectatorVote' | 'getAudienceVoteSummary'
        > = {
            createSpectatorVote: () => of({} as SpectatorVoteResponse),
            getAudienceVoteSummary: () =>
                throwError(() => ({ code: grpcStatus.INVALID_ARGUMENT })),
        };
        const client = { getService: () => scoring } as unknown as ClientGrpc;
        const controller = new GatewayController(
            client,
            createRealtimeStub() as RealtimeService,
        );
        controller.onModuleInit();

        await assert.rejects(
            () => controller.getAudienceVoteSummary(''),
            BadRequestException,
        );
    });
});
