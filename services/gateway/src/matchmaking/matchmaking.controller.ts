import {
    MATCHMAKING_SERVICE_NAME,
    type CancelMatchmakingResponse,
    type MatchResponse,
    type MatchmakingServiceClient,
} from '@contracts/matchmaking';
import { status as grpcStatus } from '@grpc/grpc-js';
import {
    Controller,
    Delete,
    Get,
    HttpCode,
    HttpStatus,
    Inject,
    InternalServerErrorException,
    NotFoundException,
    Post,
    type OnModuleInit,
    UseGuards,
} from '@nestjs/common';
import { type ClientGrpc } from '@nestjs/microservices';
import { attachUserMetadata } from '@repo/common/grpc';
import { firstValueFrom } from 'rxjs';
import type { AuthenticatedUser } from '../auth/authenticated-user';
import { AuthUserGuard } from '../auth/auth-user.guard';
import { CurrentUser } from '../auth/current-user.decorator';

interface GrpcError {
    code?: number;
}

@Controller('matchmaking')
@UseGuards(AuthUserGuard)
export class MatchmakingController implements OnModuleInit {
    private matchmaking!: MatchmakingServiceClient;

    constructor(
        @Inject('MATCHMAKING_CLIENT') private readonly matchmakingClient: ClientGrpc,
    ) {}

    onModuleInit(): void {
        this.matchmaking = this.matchmakingClient.getService<MatchmakingServiceClient>(
            MATCHMAKING_SERVICE_NAME,
        );
    }

    @Post('launch')
    @HttpCode(HttpStatus.OK)
    async launchDebate(@CurrentUser() user: AuthenticatedUser): Promise<MatchResponse> {
        try {
            return await firstValueFrom(
                this.matchmaking.launchDebate({}, attachUserMetadata(user)),
            );
        } catch (error) {
            throw this.mapError(error);
        }
    }

    @Get('status')
    async getMatchStatus(@CurrentUser() user: AuthenticatedUser): Promise<MatchResponse> {
        try {
            return await firstValueFrom(
                this.matchmaking.getMatchStatus({}, attachUserMetadata(user)),
            );
        } catch (error) {
            throw this.mapError(error);
        }
    }

    @Delete()
    @HttpCode(HttpStatus.OK)
    async cancelMatchmaking(
        @CurrentUser() user: AuthenticatedUser,
    ): Promise<CancelMatchmakingResponse> {
        try {
            return await firstValueFrom(
                this.matchmaking.cancelMatchmaking({}, attachUserMetadata(user)),
            );
        } catch (error) {
            throw this.mapError(error);
        }
    }

    private mapError(error: unknown): Error {
        const code = (error as GrpcError | null)?.code;
        if (code === grpcStatus.NOT_FOUND) return new NotFoundException('player not in queue');
        return new InternalServerErrorException('matchmaking service request failed');
    }
}
