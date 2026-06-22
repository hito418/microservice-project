import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import type { CancelMatchmakingResponse, MatchResponse } from '@contracts/matchmaking';
import { GrpcUser, type GrpcPrincipal } from '@repo/common/grpc';
import { MatchmakingService } from './matchmaking.service';

@Controller()
export class MatchmakingController {
    constructor(private readonly svc: MatchmakingService) {}

    @GrpcMethod('MatchmakingService', 'launchDebate')
    launchDebate(@GrpcUser() user: GrpcPrincipal): Promise<MatchResponse> {
        return this.svc.launchDebate(user.id);
    }

    @GrpcMethod('MatchmakingService', 'getMatchStatus')
    getMatchStatus(@GrpcUser() user: GrpcPrincipal): Promise<MatchResponse> {
        return this.svc.getMatchStatus(user.id);
    }

    @GrpcMethod('MatchmakingService', 'cancelMatchmaking')
    cancelMatchmaking(@GrpcUser() user: GrpcPrincipal): Promise<CancelMatchmakingResponse> {
        return this.svc.cancelMatchmaking(user.id);
    }
}
