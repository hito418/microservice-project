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
    HttpCode,
    HttpStatus,
    Inject,
    InternalServerErrorException,
    Logger,
    OnModuleInit,
    Post,
} from '@nestjs/common';
import { type ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { ZodValidationPipe } from '../common/zod-validation.pipe';

interface GrpcError {
    code?: number;
    details?: string;
    message?: string;
}

@Controller('auth')
export class AuthController implements OnModuleInit {
    private readonly logger = new Logger(AuthController.name);
    private auth!: AuthServiceClient;

    constructor(
        @Inject('AUTH_CLIENT') private readonly authClient: ClientGrpc,
    ) {}

    onModuleInit(): void {
        this.auth = this.authClient.getService<AuthServiceClient>(
            AUTH_SERVICE_NAME,
        );
    }

    @Post('signup')
    @HttpCode(HttpStatus.CREATED)
    async signup(
        @Body(new ZodValidationPipe(signupSchema)) dto: SignupRequest,
    ): Promise<SignupResponse> {
        this.logger.debug(`signup requested email=${dto.email}`);
        try {
            const result = await firstValueFrom(this.auth.signup(dto));
            this.logger.debug(`signup ok id=${result.id} email=${result.email}`);
            return result;
        } catch (err) {
            throw this.mapAuthError(err, dto.email);
        }
    }

    private mapAuthError(err: unknown, email: string): Error {
        const grpcErr = err as GrpcError | null;
        const code = grpcErr?.code;
        switch (code) {
            case grpcStatus.ALREADY_EXISTS:
                this.logger.warn(`signup conflict email=${email}`);
                return new ConflictException('email already registered');
            case grpcStatus.INVALID_ARGUMENT:
                this.logger.warn(`signup invalid email=${email}`);
                return new BadRequestException('invalid signup payload');
            default:
                this.logger.error(
                    `signup failed email=${email} code=${code ?? 'unknown'} details=${grpcErr?.details ?? grpcErr?.message ?? ''}`,
                );
                return new InternalServerErrorException('auth call failed');
        }
    }
}
