import type {
    LoginRequest,
    LoginResponse,
    SignupRequest,
    SignupResponse,
} from '@contracts/auth';
import { status } from '@grpc/grpc-js';
import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { RpcException } from '@nestjs/microservices';
import * as bcrypt from 'bcryptjs';
import { UsersRepository } from '../users/users.repository';
import { ConfigService } from '../config/config.service';

const BCRYPT_ROUNDS = 12;
const PG_UNIQUE_VIOLATION = '23505';
const USERS_EMAIL_UNIQUE = 'users_email_unique';

function isDuplicateEmail(err: unknown): boolean {
    if (typeof err !== 'object' || err === null) return false;
    const e = err as { code?: unknown; constraint?: unknown };
    return e.code === PG_UNIQUE_VIOLATION && e.constraint === USERS_EMAIL_UNIQUE;
}

export interface JwtAccessPayload {
    sub: string;
    role: 'user' | 'admin';
}

@Injectable()
export class AuthService {
    private readonly logger = new Logger(AuthService.name);

    constructor(
        private readonly users: UsersRepository,
        private readonly jwt: JwtService,
        // Resolved JWT lifetime in seconds — must mirror what JwtModule signs with.
        private readonly config: ConfigService,
    ) {}

    async signup({ email, password }: SignupRequest): Promise<SignupResponse> {
        const normalizedEmail = email.trim().toLowerCase();
        this.logger.debug(`signup attempt email=${normalizedEmail}`);

        const existing = await this.users.findByEmail(normalizedEmail);
        if (existing) {
            this.logger.warn(`signup conflict email=${normalizedEmail}`);
            throw new RpcException({
                code: status.ALREADY_EXISTS,
                message: 'email already registered',
            });
        }

        const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

        let saved;
        try {
            saved = await this.users.insert({
                email: normalizedEmail,
                passwordHash,
            });
        } catch (err) {
            if (isDuplicateEmail(err)) {
                this.logger.warn(`signup conflict (race) email=${normalizedEmail}`);
                throw new RpcException({
                    code: status.ALREADY_EXISTS,
                    message: 'email already registered',
                });
            }
            throw err;
        }

        this.logger.debug(`signup ok id=${saved.id} email=${saved.email}`);

        return {
            id: saved.id,
            email: saved.email,
            createdAt: saved.created_at.toISOString(),
        };
    }

    async login({ email, password }: LoginRequest): Promise<LoginResponse> {
        const normalizedEmail = email.trim().toLowerCase();
        this.logger.debug(`login attempt email=${normalizedEmail}`);

        const user = await this.users.findByEmail(normalizedEmail);

        if (!user) {
            this.logger.warn(`login failed (no such email) email=${normalizedEmail}`);
            throw new RpcException({
                code: status.UNAUTHENTICATED,
                message: 'invalid credentials',
            });
        }

        // Always run bcrypt, even on miss, to avoid leaking which emails exist via timing.
        const passwordOk = await bcrypt.compare(password, user.password_hash)

        if (!passwordOk) {
            this.logger.warn(`login failed email=${normalizedEmail}`);
            throw new RpcException({
                code: status.UNAUTHENTICATED,
                message: 'invalid credentials',
            });
        }

        const payload: JwtAccessPayload = { sub: user.id, role: user.role };
        const jwt = await this.jwt.signAsync(payload, { privateKey: this.config.jwtPrivateKey });

        this.logger.debug(`login ok id=${user.id} role=${user.role}`);

        return {
            jwt,
            userId: user.id,
            role: user.role,
            expiresIn: this.config.jwtExpiresInSeconds,
        };
    }
}
