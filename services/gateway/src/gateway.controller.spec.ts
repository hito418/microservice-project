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
    GetRandomRecentDebateForVotingRequest,
    RandomRecentDebateForVotingResponse,
    ScoringServiceClient,
    SpectatorVoteResponse,
} from '@contracts/scoring';
import type {
    GetPlayerStatsRequest,
    PlayerStatsResponse,
    ProfileServiceClient,
} from '@contracts/profile';
import type {
    ListUserPerformanceHistoryRequest,
    ListUserPerformanceHistoryResponse,
    RankingServiceClient,
} from '@contracts/ranking';
import type { AuthenticatedUser } from './auth/authenticated-user';
import { GatewayController } from './gateway.controller';
import type { RealtimeService } from './realtime/realtime.service';
import type { CreateSpectatorVoteDto } from './votes/create-spectator-vote.dto';

type RealtimeStub = Pick<RealtimeService, 'publishVoteCreated'>;

interface CreateControllerOptions {
    onSummary?: (
        request: AudienceVoteSummaryRequest,
    ) => AudienceVoteSummaryResponse;
    onAiAnalysis?: (
        request: GetAiAnalysisResultRequest,
    ) => AiAnalysisResultResponse;
    onFinalScore?: (
        request: GetFinalDebateScoreRequest,
    ) => FinalDebateScoreResponse;
    onRandomDebate?: (
        request: GetRandomRecentDebateForVotingRequest,
    ) => RandomRecentDebateForVotingResponse;
    onPlayerStats?: (request: GetPlayerStatsRequest) => PlayerStatsResponse;
    onPerformanceHistory?: (
        request: ListUserPerformanceHistoryRequest,
    ) => ListUserPerformanceHistoryResponse;
    realtime?: RealtimeStub;
}

function createRealtimeStub(
    onPublish: RealtimeStub['publishVoteCreated'] = () => undefined as never,
): RealtimeStub {
    return { publishVoteCreated: onPublish };
}

function createProfileClient(
    getPlayerStats: ProfileServiceClient['getPlayerStats'] = () =>
        of({} as PlayerStatsResponse),
): ClientGrpc {
    return {
        getService: () => ({ getPlayerStats }),
    } as unknown as ClientGrpc;
}

function createRankingClient(
    listUserPerformanceHistory: RankingServiceClient['listUserPerformanceHistory'] =
        () => of({ items: [], total: 0 }),
): ClientGrpc {
    return {
        getService: () => ({ listUserPerformanceHistory }),
    } as unknown as ClientGrpc;
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
    const onAiAnalysis = options.onAiAnalysis ?? (() => ({
        debateId: 'debate-1',
        status: 'COMPLETED',
        summary: 'FOR had stronger evidence.',
        forScore: 72,
        againstScore: 28,
        forFeedback: 'Clear argumentation.',
        againstFeedback: 'Needs more evidence.',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
    }));
    const onFinalScore = options.onFinalScore ?? (() => ({
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
    }));
    const onRandomDebate = options.onRandomDebate ?? (() => ({
        debateId: 'debate-1',
        status: 'VOTING',
        voteCount: 2,
        referenceTime: '2026-01-01T00:15:00.000Z',
    }));
    const onPlayerStats = options.onPlayerStats ?? (() => ({
        userId: '11111111-1111-1111-1111-111111111111',
        xp: 120,
        elo: 1015,
        debatesCount: 3,
        wins: 2,
        losses: 1,
        draws: 0,
        winrate: 67,
        rankTier: 'BRONZE',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
    }));
    const onPerformanceHistory = options.onPerformanceHistory ?? (() => ({
        items: [],
        total: 0,
    }));
    const realtime = options.realtime ?? createRealtimeStub();
    const scoring: Pick<
        ScoringServiceClient,
        | 'createSpectatorVote'
        | 'getAudienceVoteSummary'
        | 'getAiAnalysisResult'
        | 'getFinalDebateScore'
        | 'getRandomRecentDebateForVoting'
    > = {
        createSpectatorVote: (request, metadata) =>
            of(onCreate(request, metadata as Metadata)),
        getAudienceVoteSummary: (request) => of(onSummary(request)),
        getAiAnalysisResult: (request) => of(onAiAnalysis(request)),
        getFinalDebateScore: (request) => of(onFinalScore(request)),
        getRandomRecentDebateForVoting: (request) => of(onRandomDebate(request)),
    };
    const scoringClient = {
        getService: () => scoring,
    } as unknown as ClientGrpc;
    const profile: Pick<ProfileServiceClient, 'getPlayerStats'> = {
        getPlayerStats: (request) => of(onPlayerStats(request)),
    };
    const profileClient = {
        getService: () => profile,
    } as unknown as ClientGrpc;
    const ranking: Pick<RankingServiceClient, 'listUserPerformanceHistory'> = {
        listUserPerformanceHistory: (request) => of(onPerformanceHistory(request)),
    };
    const rankingClient = {
        getService: () => ranking,
    } as unknown as ClientGrpc;
    const controller = new GatewayController(
        scoringClient,
        profileClient,
        rankingClient,
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

describe('GatewayController AI analysis results', () => {
    it('takes debateId from the URL and returns the scoring AI analysis result', async () => {
        let received: GetAiAnalysisResultRequest | undefined;
        const controller = createController(
            () => ({} as SpectatorVoteResponse),
            {
                onAiAnalysis: (request) => {
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
        const controller = new GatewayController(
            client,
            createProfileClient(),
            createRankingClient(),
            createRealtimeStub() as RealtimeService,
        );
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
        const controller = new GatewayController(
            client,
            createProfileClient(),
            createRankingClient(),
            createRealtimeStub() as RealtimeService,
        );
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
            {
                onFinalScore: (request) => {
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
        const controller = new GatewayController(
            client,
            createProfileClient(),
            createRankingClient(),
            createRealtimeStub() as RealtimeService,
        );
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
        const controller = new GatewayController(
            client,
            createProfileClient(),
            createRankingClient(),
            createRealtimeStub() as RealtimeService,
        );
        controller.onModuleInit();

        await assert.rejects(
            () => controller.getFinalDebateScore(''),
            BadRequestException,
        );
    });
});

describe('GatewayController random recent debates for voting', () => {
    it('calls scoring without overrides so scoring defaults apply', async () => {
        let received: GetRandomRecentDebateForVotingRequest | undefined;
        const controller = createController(
            () => ({} as SpectatorVoteResponse),
            {
                onRandomDebate: (request) => {
                    received = request;
                    return {
                        debateId: 'debate-1',
                        status: 'VOTING',
                        voteCount: 2,
                        referenceTime: '2026-01-01T00:15:00.000Z',
                    };
                },
            },
        );

        const result = await controller.getRandomRecentDebateForVoting();

        assert.deepEqual(received, {
            maxAgeMinutes: undefined,
            candidatePoolSize: undefined,
        });
        assert.deepEqual(result, {
            debateId: 'debate-1',
            status: 'VOTING',
            voteCount: 2,
            referenceTime: '2026-01-01T00:15:00.000Z',
        });
    });

    it('passes optional query params to scoring as numbers', async () => {
        let received: GetRandomRecentDebateForVotingRequest | undefined;
        const controller = createController(
            () => ({} as SpectatorVoteResponse),
            {
                onRandomDebate: (request) => {
                    received = request;
                    return {
                        debateId: 'debate-1',
                        status: 'RUNNING',
                        voteCount: 0,
                        referenceTime: '2026-01-01T00:15:00.000Z',
                    };
                },
            },
        );

        await controller.getRandomRecentDebateForVoting('30', '10');

        assert.deepEqual(received, {
            maxAgeMinutes: 30,
            candidatePoolSize: 10,
        });
    });

    it('rejects non-integer query params before calling scoring', async () => {
        let scoringCalled = false;
        const controller = createController(
            () => ({} as SpectatorVoteResponse),
            {
                onRandomDebate: () => {
                    scoringCalled = true;
                    return {} as RandomRecentDebateForVotingResponse;
                },
            },
        );

        await assert.rejects(
            () => controller.getRandomRecentDebateForVoting('abc'),
            BadRequestException,
        );
        assert.equal(scoringCalled, false);
    });

    it('maps scoring random debate NOT_FOUND errors to HTTP 404', async () => {
        const scoring: Pick<
            ScoringServiceClient,
            | 'createSpectatorVote'
            | 'getAudienceVoteSummary'
            | 'getAiAnalysisResult'
            | 'getFinalDebateScore'
            | 'getRandomRecentDebateForVoting'
        > = {
            createSpectatorVote: () => of({} as SpectatorVoteResponse),
            getAudienceVoteSummary: () => of({} as AudienceVoteSummaryResponse),
            getAiAnalysisResult: () => of({} as AiAnalysisResultResponse),
            getFinalDebateScore: () => of({} as FinalDebateScoreResponse),
            getRandomRecentDebateForVoting: () =>
                throwError(() => ({ code: grpcStatus.NOT_FOUND })),
        };
        const client = { getService: () => scoring } as unknown as ClientGrpc;
        const controller = new GatewayController(
            client,
            createProfileClient(),
            createRankingClient(),
            createRealtimeStub() as RealtimeService,
        );
        controller.onModuleInit();

        await assert.rejects(
            () => controller.getRandomRecentDebateForVoting(),
            NotFoundException,
        );
    });

    it('maps scoring random debate validation errors to HTTP 400', async () => {
        const scoring: Pick<
            ScoringServiceClient,
            | 'createSpectatorVote'
            | 'getAudienceVoteSummary'
            | 'getAiAnalysisResult'
            | 'getFinalDebateScore'
            | 'getRandomRecentDebateForVoting'
        > = {
            createSpectatorVote: () => of({} as SpectatorVoteResponse),
            getAudienceVoteSummary: () => of({} as AudienceVoteSummaryResponse),
            getAiAnalysisResult: () => of({} as AiAnalysisResultResponse),
            getFinalDebateScore: () => of({} as FinalDebateScoreResponse),
            getRandomRecentDebateForVoting: () =>
                throwError(() => ({ code: grpcStatus.INVALID_ARGUMENT })),
        };
        const client = { getService: () => scoring } as unknown as ClientGrpc;
        const controller = new GatewayController(
            client,
            createProfileClient(),
            createRankingClient(),
            createRealtimeStub() as RealtimeService,
        );
        controller.onModuleInit();

        await assert.rejects(
            () => controller.getRandomRecentDebateForVoting('0'),
            BadRequestException,
        );
    });
});

describe('GatewayController player stats', () => {
    it('takes userId from the URL and returns profile stats', async () => {
        let received: GetPlayerStatsRequest | undefined;
        const controller = createController(
            () => ({} as SpectatorVoteResponse),
            {
                onPlayerStats: (request) => {
                    received = request;
                    return {
                        userId: '11111111-1111-1111-1111-111111111111',
                        xp: 240,
                        elo: 1030,
                        debatesCount: 4,
                        wins: 3,
                        losses: 1,
                        draws: 0,
                        winrate: 75,
                        rankTier: 'BRONZE',
                        createdAt: '2026-01-01T00:00:00.000Z',
                        updatedAt: '2026-01-02T00:00:00.000Z',
                    };
                },
            },
        );

        const result = await controller.getPlayerStats(
            '11111111-1111-1111-1111-111111111111',
        );

        assert.deepEqual(received, {
            userId: '11111111-1111-1111-1111-111111111111',
        });
        assert.deepEqual(result, {
            userId: '11111111-1111-1111-1111-111111111111',
            xp: 240,
            elo: 1030,
            debatesCount: 4,
            wins: 3,
            losses: 1,
            draws: 0,
            winrate: 75,
            rankTier: 'BRONZE',
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-02T00:00:00.000Z',
        });
    });

    it('maps profile stats NOT_FOUND errors to HTTP 404', async () => {
        const scoringClient = {
            getService: () => ({} as ScoringServiceClient),
        } as unknown as ClientGrpc;
        const profileClient = createProfileClient(() =>
            throwError(() => ({ code: grpcStatus.NOT_FOUND })),
        );
        const controller = new GatewayController(
            scoringClient,
            profileClient,
            createRankingClient(),
            createRealtimeStub() as RealtimeService,
        );
        controller.onModuleInit();

        await assert.rejects(
            () =>
                controller.getPlayerStats(
                    '11111111-1111-1111-1111-111111111111',
                ),
            NotFoundException,
        );
    });

    it('maps profile stats validation errors to HTTP 400', async () => {
        const scoringClient = {
            getService: () => ({} as ScoringServiceClient),
        } as unknown as ClientGrpc;
        const profileClient = createProfileClient(() =>
            throwError(() => ({ code: grpcStatus.INVALID_ARGUMENT })),
        );
        const controller = new GatewayController(
            scoringClient,
            profileClient,
            createRankingClient(),
            createRealtimeStub() as RealtimeService,
        );
        controller.onModuleInit();

        await assert.rejects(
            () => controller.getPlayerStats('not-a-uuid'),
            BadRequestException,
        );
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
            createProfileClient(),
            createRankingClient(),
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
            createProfileClient(),
            createRankingClient(),
            createRealtimeStub() as RealtimeService,
        );
        controller.onModuleInit();

        await assert.rejects(
            () => controller.getAudienceVoteSummary(''),
            BadRequestException,
        );
    });
});

describe('GatewayController performance history', () => {
    it('takes userId from the URL and passes pagination to ranking', async () => {
        let received: ListUserPerformanceHistoryRequest | undefined;
        const controller = createController(
            () => ({} as SpectatorVoteResponse),
            {
                onPerformanceHistory: (request) => {
                    received = request;
                    return {
                        items: [
                            {
                                id: '33333333-3333-3333-3333-333333333333',
                                userId: '11111111-1111-1111-1111-111111111111',
                                debateId: 'debate-1',
                                side: 'FOR',
                                result: 'WIN',
                                finalScore: 84,
                                opponentScore: 62,
                                xpDelta: 0,
                                eloDelta: 0,
                                createdAt: '2026-01-01T00:00:00.000Z',
                            },
                        ],
                        total: 1,
                    };
                },
            },
        );

        const result = await controller.listUserPerformanceHistory(
            '11111111-1111-1111-1111-111111111111',
            '10',
            '5',
        );

        assert.deepEqual(received, {
            userId: '11111111-1111-1111-1111-111111111111',
            limit: 10,
            offset: 5,
        });
        assert.equal(result.total, 1);
        assert.equal(result.items[0]?.debateId, 'debate-1');
    });

    it('rejects non-integer pagination before calling ranking', async () => {
        let rankingCalled = false;
        const controller = createController(
            () => ({} as SpectatorVoteResponse),
            {
                onPerformanceHistory: () => {
                    rankingCalled = true;
                    return { items: [], total: 0 };
                },
            },
        );

        await assert.rejects(
            () =>
                controller.listUserPerformanceHistory(
                    '11111111-1111-1111-1111-111111111111',
                    'abc',
                ),
            BadRequestException,
        );
        assert.equal(rankingCalled, false);
    });

    it('maps ranking validation errors to HTTP 400', async () => {
        const scoringClient = {
            getService: () => ({} as ScoringServiceClient),
        } as unknown as ClientGrpc;
        const rankingClient = createRankingClient(() =>
            throwError(() => ({ code: grpcStatus.INVALID_ARGUMENT })),
        );
        const controller = new GatewayController(
            scoringClient,
            createProfileClient(),
            rankingClient,
            createRealtimeStub() as RealtimeService,
        );
        controller.onModuleInit();

        await assert.rejects(
            () => controller.listUserPerformanceHistory('not-a-uuid'),
            BadRequestException,
        );
    });
});
