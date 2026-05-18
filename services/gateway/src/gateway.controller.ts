import {
    AUTH_SERVICE_NAME,
    type AuthServiceClient,
    type SignupRequest,
    type SignupResponse,
    signupSchema,
} from '@contracts/auth';
import { status as grpcStatus } from '@grpc/grpc-js';
import {
    BadRequestException,
    Body,
    ConflictException,
    Controller,
    HttpException,
    Get,
    HttpCode,
    HttpStatus,
    Inject,
    InternalServerErrorException,
    OnModuleInit,
    Param,
    ParseIntPipe,
    Post,
    UseGuards,
} from '@nestjs/common';
import {
    type ClientGrpc,
    type ClientProxy,
} from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import type { AuthenticatedUser } from './auth/authenticated-user';
import { AuthUserGuard } from './auth/auth-user.guard';
import { CurrentUser } from './auth/current-user.decorator';
import { CreateSpectatorVoteDto } from './votes/create-spectator-vote.dto';
import { ZodValidationPipe } from './common/zod-validation.pipe';

type SpectatorVoteResponse = {
    id: string;
    debateId: string;
    userId: string;
    side: string;
    createdAt: string;
};

type RpcErrorPayload = {
    statusCode?: number;
    message?: string | string[];
};

interface GrpcError {
    code?: number;
    details?: string;
    message?: string;
}

@Controller()
export class GatewayController implements OnModuleInit {
    private auth!: AuthServiceClient;

    constructor(
        @Inject('FIBONACCI_SERVICE') private readonly fibonacciClient: ClientProxy,
        @Inject('SCORING_SERVICE') private readonly scoringClient: ClientProxy,
        @Inject('AUTH_CLIENT') private readonly authClient: ClientGrpc,
    ) {}

    onModuleInit(): void {
        this.auth = this.authClient.getService<AuthServiceClient>(
            AUTH_SERVICE_NAME,
        );
    }

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
    
    @Post('auth/signup')
    @HttpCode(HttpStatus.CREATED)
    async signup(
        @Body(new ZodValidationPipe(signupSchema)) dto: SignupRequest,
    ): Promise<SignupResponse> {
        try {
            return await firstValueFrom(this.auth.signup(dto));
        } catch (err) {
            throw this.mapAuthError(err);
        }
    }

    private mapAuthError(err: unknown): Error {
        const code = (err as GrpcError | null)?.code;
        switch (code) {
            case grpcStatus.ALREADY_EXISTS:
                return new ConflictException('email already registered');
            case grpcStatus.INVALID_ARGUMENT:
                return new BadRequestException('invalid signup payload');
            default:
                return new InternalServerErrorException('auth call failed');
        }
    }
}
