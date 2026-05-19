import {
    BadRequestException,
    Body,
    Controller,
    Get,
    HttpException,
    HttpStatus,
    Inject,
    Param,
    ParseIntPipe,
    Post,
    UseGuards,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import type { AuthenticatedUser } from './auth/authenticated-user';
import { AuthUserGuard } from './auth/auth-user.guard';
import { CurrentUser } from './auth/current-user.decorator';
import { CreateSpectatorVoteDto } from './votes/create-spectator-vote.dto';

type SpectatorVoteResponse = {
    id: string;
    debateId: string;
    userId: string;
    side: string;
    createdAt: string;
};

type AudienceVoteSummaryResponse = {
    debateId: string;
    totalVotes: number;
    forVotes: number;
    againstVotes: number;
    forScore: number;
    againstScore: number;
};

type RpcErrorPayload = {
    statusCode?: number;
    message?: string | string[];
};

@Controller()
export class GatewayController {
    constructor(
        @Inject('FIBONACCI_SERVICE') private readonly fibonacciClient: ClientProxy,
        @Inject('SCORING_SERVICE') private readonly scoringClient: ClientProxy,
    ) {}

    @Get('fibonacci/:n')
    async fibonacci(
        @Param('n', ParseIntPipe) n: number,
    ): Promise<{ n: number; value: number }> {
        if (n < 0) {
            throw new BadRequestException('n must be a non-negative integer');
        }
        const value = await firstValueFrom(
            this.fibonacciClient.send<number>({ cmd: 'fibonacci.compute' }, { n }),
        );
        return { n, value };
    }

    @Post('debates/:debateId/votes')
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
            return await firstValueFrom(
                this.scoringClient.send<SpectatorVoteResponse>(
                    { cmd: 'scoring.spectator-vote.create' },
                    { debateId, userId: user.id, side: body.side },
                ),
            );
        } catch (error) {
            throw this.toHttpException(error);
        }
    }

    @Get('debates/:debateId/votes/summary')
    async getAudienceVoteSummary(
        @Param('debateId') debateId: string,
    ): Promise<AudienceVoteSummaryResponse> {
        try {
            return await firstValueFrom(
                this.scoringClient.send<AudienceVoteSummaryResponse>(
                    { cmd: 'scoring.audience-votes.summary' },
                    { debateId },
                ),
            );
        } catch (error) {
            throw this.toHttpException(error);
        }
    }

    private toHttpException(error: unknown): HttpException {
        const payload = this.getRpcErrorPayload(error);
        const statusCode = payload?.statusCode ?? HttpStatus.INTERNAL_SERVER_ERROR;
        const message = payload?.message ?? 'Scoring service request failed';

        return new HttpException({ message }, statusCode);
    }

    private getRpcErrorPayload(error: unknown): RpcErrorPayload | undefined {
        if (!this.isRecord(error)) {
            return undefined;
        }

        if (this.isRpcErrorPayload(error)) {
            return error;
        }

        const response = error.response;
        if (this.isRpcErrorPayload(response)) {
            return response;
        }

        return undefined;
    }

    private isRpcErrorPayload(value: unknown): value is RpcErrorPayload {
        if (!this.isRecord(value)) {
            return false;
        }

        return (
            (typeof value.statusCode === 'number' || value.statusCode === undefined) &&
            (typeof value.message === 'string' ||
                Array.isArray(value.message) ||
                value.message === undefined)
        );
    }

    private isRecord(value: unknown): value is Record<string, unknown> {
        return typeof value === 'object' && value !== null;
    }
}
