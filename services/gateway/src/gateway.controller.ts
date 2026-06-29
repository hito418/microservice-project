import {
    PROFILE_SERVICE_NAME,
    type PlayerStatsResponse,
    type ProfileServiceClient,
} from '@contracts/profile';
import {
    RANKING_SERVICE_NAME,
    type ListUserPerformanceHistoryResponse,
    type RankingServiceClient,
} from '@contracts/ranking';
import {
    SCORING_SERVICE_NAME,
    type AiAnalysisResultResponse,
    type AudienceVoteSummaryResponse,
    type FinalDebateScoreResponse,
    type GetRandomRecentDebateForVotingRequest,
    type RandomRecentDebateForVotingResponse,
    type ScoringServiceClient,
    type SpectatorVoteResponse,
} from '@contracts/scoring';
import { status as grpcStatus } from '@grpc/grpc-js';
import {
    BadRequestException,
    ConflictException,
    Controller,
    HttpCode,
    HttpStatus,
    Inject,
    InternalServerErrorException,
    NotFoundException,
    type OnModuleInit,
    Param,
    Get,
    Post,
    Query,
    UseGuards,
    Body,
} from '@nestjs/common';
import { type ClientGrpc } from '@nestjs/microservices';
import { attachUserMetadata } from '@repo/common/grpc';
import { firstValueFrom } from 'rxjs';
import type { AuthenticatedUser } from './auth/authenticated-user';
import { AuthUserGuard } from './auth/auth-user.guard';
import { CurrentUser } from './auth/current-user.decorator';
import { RealtimeService } from './realtime/realtime.service';
import { CreateSpectatorVoteDto } from './votes/create-spectator-vote.dto';

interface GrpcError {
    code?: number;
}

@Controller()
export class GatewayController implements OnModuleInit {
    private scoring!: ScoringServiceClient;
    private profile!: ProfileServiceClient;
    private ranking!: RankingServiceClient;

    constructor(
        @Inject('SCORING_CLIENT') private readonly scoringClient: ClientGrpc,
        @Inject('PROFILE_CLIENT') private readonly profileClient: ClientGrpc,
        @Inject('RANKING_CLIENT') private readonly rankingClient: ClientGrpc,
        private readonly realtime: RealtimeService,
    ) {}

    onModuleInit(): void {
        this.scoring =
            this.scoringClient.getService<ScoringServiceClient>(SCORING_SERVICE_NAME);
        this.profile =
            this.profileClient.getService<ProfileServiceClient>(PROFILE_SERVICE_NAME);
        this.ranking =
            this.rankingClient.getService<RankingServiceClient>(RANKING_SERVICE_NAME);
    }

    @Post('debates/:debateId/votes')
    @HttpCode(HttpStatus.CREATED)
    @UseGuards(AuthUserGuard)
    async createSpectatorVote(
        @Param('debateId') debateId: string,
        @Body() body: CreateSpectatorVoteDto | undefined,
        @CurrentUser() user: AuthenticatedUser,
    ): Promise<SpectatorVoteResponse> {
        if (!body) {
            throw new BadRequestException('Request body is required');
        }

        try {
            const vote = await firstValueFrom(
                this.scoring.createSpectatorVote(
                    { debateId, side: body.side ?? '' },
                    attachUserMetadata(user),
                ),
            );
            this.realtime.publishVoteCreated(vote);
            return vote;
        } catch (error) {
            throw this.mapScoringError(error);
        }
    }

    @Get('debates/:debateId/votes/summary')
    async getAudienceVoteSummary(
        @Param('debateId') debateId: string,
    ): Promise<AudienceVoteSummaryResponse> {
        try {
            return await firstValueFrom(
                this.scoring.getAudienceVoteSummary({ debateId }),
            );
        } catch (error) {
            throw this.mapScoringError(error);
        }
    }

    @Get('debates/:debateId/ai-analysis')
    async getAiAnalysisResult(
        @Param('debateId') debateId: string,
    ): Promise<AiAnalysisResultResponse> {
        try {
            return await firstValueFrom(
                this.scoring.getAiAnalysisResult({ debateId }),
            );
        } catch (error) {
            throw this.mapScoringError(error);
        }
    }

    @Get('debates/:debateId/final-score')
    async getFinalDebateScore(
        @Param('debateId') debateId: string,
    ): Promise<FinalDebateScoreResponse> {
        try {
            return await firstValueFrom(
                this.scoring.getFinalDebateScore({ debateId }),
            );
        } catch (error) {
            throw this.mapScoringError(error);
        }
    }

    @Get('debates/random-for-voting')
    async getRandomRecentDebateForVoting(
        @Query('maxAgeMinutes') maxAgeMinutes?: string,
        @Query('candidatePoolSize') candidatePoolSize?: string,
    ): Promise<RandomRecentDebateForVotingResponse> {
        const request: GetRandomRecentDebateForVotingRequest = {
            maxAgeMinutes: parseOptionalInteger(maxAgeMinutes, 'maxAgeMinutes'),
            candidatePoolSize: parseOptionalInteger(
                candidatePoolSize,
                'candidatePoolSize',
            ),
        };

        try {
            return await firstValueFrom(
                this.scoring.getRandomRecentDebateForVoting(request),
            );
        } catch (error) {
            throw this.mapScoringError(error);
        }
    }

    @Get('profiles/:userId/stats')
    async getPlayerStats(
        @Param('userId') userId: string,
    ): Promise<PlayerStatsResponse> {
        try {
            return await firstValueFrom(this.profile.getPlayerStats({ userId }));
        } catch (error) {
            throw this.mapProfileError(error);
        }
    }

    @Get('profiles/:userId/performance-history')
    async listUserPerformanceHistory(
        @Param('userId') userId: string,
        @Query('limit') limit?: string,
        @Query('offset') offset?: string,
    ): Promise<ListUserPerformanceHistoryResponse> {
        const request = {
            userId,
            limit: parseOptionalInteger(limit, 'limit'),
            offset: parseOptionalInteger(offset, 'offset'),
        };

        try {
            return await firstValueFrom(
                this.ranking.listUserPerformanceHistory(request),
            );
        } catch (error) {
            throw this.mapRankingError(error);
        }
    }

    private mapScoringError(error: unknown): Error {
        const code = (error as GrpcError | null)?.code;
        switch (code) {
            case grpcStatus.INVALID_ARGUMENT:
                return new BadRequestException('invalid vote payload');
            case grpcStatus.NOT_FOUND:
                return new NotFoundException('debate not found');
            case grpcStatus.FAILED_PRECONDITION:
                return new ConflictException('scoring precondition failed');
            case grpcStatus.ALREADY_EXISTS:
                return new ConflictException('you have already voted on this debate');
            default:
                return new InternalServerErrorException('scoring service request failed');
        }
    }

    private mapProfileError(error: unknown): Error {
        const code = (error as GrpcError | null)?.code;
        switch (code) {
            case grpcStatus.INVALID_ARGUMENT:
                return new BadRequestException('invalid profile payload');
            case grpcStatus.NOT_FOUND:
                return new NotFoundException('profile stats not found');
            default:
                return new InternalServerErrorException('profile service request failed');
        }
    }

    private mapRankingError(error: unknown): Error {
        const code = (error as GrpcError | null)?.code;
        switch (code) {
            case grpcStatus.INVALID_ARGUMENT:
                return new BadRequestException('invalid ranking payload');
            case grpcStatus.NOT_FOUND:
                return new NotFoundException('ranking history not found');
            default:
                return new InternalServerErrorException('ranking service request failed');
        }
    }
}

function parseOptionalInteger(
    value: string | undefined,
    fieldName: string,
): number | undefined {
    if (value === undefined) return undefined;
    const parsed = Number(value);
    if (!Number.isInteger(parsed)) {
        throw new BadRequestException(`${fieldName} must be an integer`);
    }
    return parsed;
}
