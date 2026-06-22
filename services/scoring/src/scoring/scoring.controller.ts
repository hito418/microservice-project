import {
    type AiAnalysisResultResponse,
    type AudienceVoteSummaryRequest,
    type AudienceVoteSummaryResponse,
    audienceVoteSummarySchema,
    type ComputeFinalDebateScoreRequest,
    computeFinalDebateScoreSchema,
    type CreateSpectatorVoteRequest,
    createSpectatorVoteSchema,
    type DebateResponse,
    type FinalDebateScoreResponse,
    type GetAiAnalysisResultRequest,
    getAiAnalysisResultSchema,
    type GetFinalDebateScoreRequest,
    getFinalDebateScoreSchema,
    ScoringServiceControllerMethods,
    type StoreAiAnalysisResultRequest,
    storeAiAnalysisResultSchema,
    type SpectatorVoteResponse,
    type UpsertDebateRequest,
    upsertDebateSchema,
    type ScoringServiceController,
} from '@contracts/scoring';
import { Controller } from '@nestjs/common';
import { Payload } from '@nestjs/microservices';
import { ZodRpcValidationPipe } from '@repo/common/pipes';
import { GrpcUser, type GrpcPrincipal } from '@repo/common/grpc';
import { ScoringService } from './scoring.service';
import { SpectatorVotesService } from '../votes/spectator-votes.service';

@Controller()
@ScoringServiceControllerMethods()
export class ScoringController implements ScoringServiceController {
    constructor(
        private readonly spectatorVotes: SpectatorVotesService,
        private readonly scoringService: ScoringService,
    ) {}

    createSpectatorVote(
        @Payload(new ZodRpcValidationPipe(createSpectatorVoteSchema))
        request: CreateSpectatorVoteRequest,
        @GrpcUser() user: GrpcPrincipal,
    ): Promise<SpectatorVoteResponse> {
        return this.spectatorVotes.createVote(request, user.id);
    }

    getAudienceVoteSummary(
        @Payload(new ZodRpcValidationPipe(audienceVoteSummarySchema))
        request: AudienceVoteSummaryRequest,
    ): Promise<AudienceVoteSummaryResponse> {
        return this.spectatorVotes.getSummary(request);
    }

    storeAiAnalysisResult(
        @Payload(new ZodRpcValidationPipe(storeAiAnalysisResultSchema))
        request: StoreAiAnalysisResultRequest,
    ): Promise<AiAnalysisResultResponse> {
        return this.scoringService.storeAiAnalysisResult(request);
    }

    getAiAnalysisResult(
        @Payload(new ZodRpcValidationPipe(getAiAnalysisResultSchema))
        request: GetAiAnalysisResultRequest,
    ): Promise<AiAnalysisResultResponse> {
        return this.scoringService.getAiAnalysisResult(request);
    }

    computeFinalDebateScore(
        @Payload(new ZodRpcValidationPipe(computeFinalDebateScoreSchema))
        request: ComputeFinalDebateScoreRequest,
    ): Promise<FinalDebateScoreResponse> {
        return this.scoringService.computeFinalDebateScore(request);
    }

    getFinalDebateScore(
        @Payload(new ZodRpcValidationPipe(getFinalDebateScoreSchema))
        request: GetFinalDebateScoreRequest,
    ): Promise<FinalDebateScoreResponse> {
        return this.scoringService.getFinalDebateScore(request);
    }

    upsertDebate(
        @Payload(new ZodRpcValidationPipe(upsertDebateSchema))
        request: UpsertDebateRequest,
    ): Promise<DebateResponse> {
        return this.scoringService.upsertDebate(request);
    }
}
