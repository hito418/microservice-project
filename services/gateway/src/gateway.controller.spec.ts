import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import { status as grpcStatus, type Metadata } from '@grpc/grpc-js';
import { readUserMetadata } from '@repo/common/grpc';
import { of, throwError } from 'rxjs';
import type {
    AiAnalysisResultResponse,
    AudienceVoteSummaryRequest,
    AudienceVoteSummaryResponse,
    CreateSpectatorVoteRequest,
    FinalDebateScoreResponse,
    GetAiAnalysisResultRequest,
    GetFinalDebateScoreRequest,
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
    onSummary: (
        request: AudienceVoteSummaryRequest,
    ) => AudienceVoteSummaryResponse = () => ({
        debateId: 'debate-1',
        totalVotes: 0,
        forVotes: 0,
        againstVotes: 0,
        forScore: 0,
        againstScore: 0,
    }),
    onAiAnalysis: (
        request: GetAiAnalysisResultRequest,
    ) => AiAnalysisResultResponse = () => ({
        debateId: 'debate-1',
        status: 'COMPLETED',
        summary: 'FOR had stronger evidence.',
        forScore: 72,
        againstScore: 28,
        forFeedback: 'Clear argumentation.',
        againstFeedback: 'Needs more evidence.',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
    }),
    onFinalScore: (
        request: GetFinalDebateScoreRequest,
    ) => FinalDebateScoreResponse = () => ({
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
    }),
): GatewayController {
    const scoring: Pick<
        ScoringServiceClient,
        | 'createSpectatorVote'
        | 'getAudienceVoteSummary'
        | 'getAiAnalysisResult'
        | 'getFinalDebateScore'
    > = {
        createSpectatorVote: (request, metadata) =>
            of(onCreate(request, metadata as Metadata)),
        getAudienceVoteSummary: (request) => of(onSummary(request)),
        getAiAnalysisResult: (request) => of(onAiAnalysis(request)),
        getFinalDebateScore: (request) => of(onFinalScore(request)),
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

describe('GatewayController AI analysis results', () => {
    it('takes debateId from the URL and returns the scoring AI analysis result', async () => {
        let received: GetAiAnalysisResultRequest | undefined;
        const controller = createController(
            () => ({} as SpectatorVoteResponse),
            undefined,
            (request) => {
                received = request;
                return {
                    debateId: 'url-debate',
                    status: 'COMPLETED',
                    summary: 'FOR had stronger evidence.',
                    forScore: 72,
                    againstScore: 28,
                    forFeedback: 'Clear argumentation.',
                    againstFeedback: 'Needs more evidence.',
                    createdAt: '2026-01-01T00:00:00.000Z',
                    updatedAt: '2026-01-01T00:00:00.000Z',
                };
            },
        );

        const result = await controller.getAiAnalysisResult('url-debate');

        assert.deepEqual(received, { debateId: 'url-debate' });
        assert.deepEqual(result, {
            debateId: 'url-debate',
            status: 'COMPLETED',
            summary: 'FOR had stronger evidence.',
            forScore: 72,
            againstScore: 28,
            forFeedback: 'Clear argumentation.',
            againstFeedback: 'Needs more evidence.',
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
        });
    });

    it('maps scoring AI analysis NOT_FOUND errors to HTTP 404', async () => {
        const scoring: Pick<
            ScoringServiceClient,
            'createSpectatorVote' | 'getAudienceVoteSummary' | 'getAiAnalysisResult'
        > = {
            createSpectatorVote: () => of({} as SpectatorVoteResponse),
            getAudienceVoteSummary: () => of({} as AudienceVoteSummaryResponse),
            getAiAnalysisResult: () =>
                throwError(() => ({ code: grpcStatus.NOT_FOUND })),
        };
        const client = { getService: () => scoring } as unknown as ClientGrpc;
        const controller = new GatewayController(client);
        controller.onModuleInit();

        await assert.rejects(
            () => controller.getAiAnalysisResult('missing'),
            NotFoundException,
        );
    });

    it('maps scoring AI analysis validation errors to HTTP 400', async () => {
        const scoring: Pick<
            ScoringServiceClient,
            'createSpectatorVote' | 'getAudienceVoteSummary' | 'getAiAnalysisResult'
        > = {
            createSpectatorVote: () => of({} as SpectatorVoteResponse),
            getAudienceVoteSummary: () => of({} as AudienceVoteSummaryResponse),
            getAiAnalysisResult: () =>
                throwError(() => ({ code: grpcStatus.INVALID_ARGUMENT })),
        };
        const client = { getService: () => scoring } as unknown as ClientGrpc;
        const controller = new GatewayController(client);
        controller.onModuleInit();

        await assert.rejects(
            () => controller.getAiAnalysisResult(''),
            BadRequestException,
        );
    });
});

describe('GatewayController final debate scores', () => {
    it('takes debateId from the URL and returns the scoring final score', async () => {
        let received: GetFinalDebateScoreRequest | undefined;
        const controller = createController(
            () => ({} as SpectatorVoteResponse),
            undefined,
            undefined,
            (request) => {
                received = request;
                return {
                    debateId: 'url-debate',
                    aiForScore: 80,
                    aiAgainstScore: 20,
                    audienceForScore: 60,
                    audienceAgainstScore: 40,
                    finalForScore: 70,
                    finalAgainstScore: 30,
                    winnerSide: 'FOR',
                    createdAt: '2026-01-01T00:00:00.000Z',
                    updatedAt: '2026-01-01T00:00:00.000Z',
                };
            },
        );

        const result = await controller.getFinalDebateScore('url-debate');

        assert.deepEqual(received, { debateId: 'url-debate' });
        assert.deepEqual(result, {
            debateId: 'url-debate',
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

    it('maps scoring final score NOT_FOUND errors to HTTP 404', async () => {
        const scoring: Pick<
            ScoringServiceClient,
            | 'createSpectatorVote'
            | 'getAudienceVoteSummary'
            | 'getAiAnalysisResult'
            | 'getFinalDebateScore'
        > = {
            createSpectatorVote: () => of({} as SpectatorVoteResponse),
            getAudienceVoteSummary: () => of({} as AudienceVoteSummaryResponse),
            getAiAnalysisResult: () => of({} as AiAnalysisResultResponse),
            getFinalDebateScore: () =>
                throwError(() => ({ code: grpcStatus.NOT_FOUND })),
        };
        const client = { getService: () => scoring } as unknown as ClientGrpc;
        const controller = new GatewayController(client);
        controller.onModuleInit();

        await assert.rejects(
            () => controller.getFinalDebateScore('missing'),
            NotFoundException,
        );
    });

    it('maps scoring final score validation errors to HTTP 400', async () => {
        const scoring: Pick<
            ScoringServiceClient,
            | 'createSpectatorVote'
            | 'getAudienceVoteSummary'
            | 'getAiAnalysisResult'
            | 'getFinalDebateScore'
        > = {
            createSpectatorVote: () => of({} as SpectatorVoteResponse),
            getAudienceVoteSummary: () => of({} as AudienceVoteSummaryResponse),
            getAiAnalysisResult: () => of({} as AiAnalysisResultResponse),
            getFinalDebateScore: () =>
                throwError(() => ({ code: grpcStatus.INVALID_ARGUMENT })),
        };
        const client = { getService: () => scoring } as unknown as ClientGrpc;
        const controller = new GatewayController(client);
        controller.onModuleInit();

        await assert.rejects(
            () => controller.getFinalDebateScore(''),
            BadRequestException,
        );
    });
});

describe('GatewayController audience vote summaries', () => {
    it('takes debateId from the URL and returns the scoring summary', async () => {
        let received: AudienceVoteSummaryRequest | undefined;
        const controller = createController(
            () => ({} as SpectatorVoteResponse),
            (request) => {
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
        const controller = new GatewayController(client);
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
        const controller = new GatewayController(client);
        controller.onModuleInit();

        await assert.rejects(
            () => controller.getAudienceVoteSummary(''),
            BadRequestException,
        );
    });
});
