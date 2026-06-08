import {
    AUTH_SERVICE_NAME,
    type AuthServiceClient,
    type LoginRequest,
    loginSchema,
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
    Res,
    UnauthorizedException,
} from '@nestjs/common';
import { type ClientGrpc } from '@nestjs/microservices';
import { ZodHttpValidationPipe } from '@repo/common/pipes';
import { type FastifyReply } from 'fastify';
import { firstValueFrom } from 'rxjs';
import { ConfigService } from '../config/config.service';

interface GrpcError {
    code?: number;
    details?: string;
    message?: string;
}

interface LoginBody {
    userId: string;
    role: string;
    expiresIn: number;
}

@Controller('auth')
export class AuthController implements OnModuleInit {
    private readonly logger = new Logger(AuthController.name);
    private auth!: AuthServiceClient;

    constructor(
        @Inject('AUTH_CLIENT') private readonly authClient: ClientGrpc,
        private readonly config: ConfigService,
    ) {}

    onModuleInit(): void {
        this.auth = this.authClient.getService<AuthServiceClient>(
            AUTH_SERVICE_NAME,
        );
    }

    @Post('signup')
    @HttpCode(HttpStatus.CREATED)
    async signup(
        @Body(new ZodHttpValidationPipe(signupSchema)) dto: SignupRequest,
    ): Promise<SignupResponse> {
        this.logger.debug(`signup requested email=${dto.email}`);
        try {
            const result = await firstValueFrom(this.auth.signup(dto));
            this.logger.debug(`signup ok id=${result.id} email=${result.email}`);
            return result;
        } catch (err) {
            throw this.mapSignupError(err, dto.email);
        }
    }

    @Post('login')
    @HttpCode(HttpStatus.OK)
    async login(
        @Body(new ZodHttpValidationPipe(loginSchema)) dto: LoginRequest,
        @Res({ passthrough: true }) reply: FastifyReply,
    ): Promise<LoginBody> {
        this.logger.debug(`login requested email=${dto.email}`);
        let result;
        try {
            result = await firstValueFrom(this.auth.login(dto));
        } catch (err) {
            throw this.mapLoginError(err, dto.email);
        }

        reply.setCookie(this.config.authCookieName, result.jwt, {
            httpOnly: true,
            secure: this.config.authCookieSecure,
            sameSite: this.config.authCookieSameSite,
            path: this.config.authCookiePath,
            maxAge: result.expiresIn,
        });

        this.logger.debug(`login ok userId=${result.userId} role=${result.role}`);

        return {
            userId: result.userId,
            role: result.role,
            expiresIn: result.expiresIn,
        };
    }

    private mapSignupError(err: unknown, email: string): Error {
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

    private mapLoginError(err: unknown, email: string): Error {
        const grpcErr = err as GrpcError | null;
        const code = grpcErr?.code;
        switch (code) {
            case grpcStatus.UNAUTHENTICATED:
                this.logger.warn(`login unauthorized email=${email}`);
                return new UnauthorizedException('invalid credentials');
            case grpcStatus.INVALID_ARGUMENT:
                this.logger.warn(`login invalid email=${email}`);
                return new BadRequestException('invalid login payload');
            default:
                this.logger.error(
                    `login failed email=${email} code=${code ?? 'unknown'} details=${grpcErr?.details ?? grpcErr?.message ?? ''}`,
                );
                return new InternalServerErrorException('auth call failed');
        }
    }
}
