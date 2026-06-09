import {
    type CreateSpectatorVoteRequest,
    createSpectatorVoteSchema,
    type DebateResponse,
    ScoringServiceControllerMethods,
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

    upsertDebate(
        @Payload(new ZodRpcValidationPipe(upsertDebateSchema))
        request: UpsertDebateRequest,
    ): Promise<DebateResponse> {
        return this.scoringService.upsertDebate(request);
    }
}
