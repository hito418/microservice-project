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
import { DISPLAY_NAME_MAX_LENGTH } from '@contracts/profile';
import * as bcrypt from 'bcryptjs';
import { UsersRepository } from '../users/users.repository';
import { ConfigService } from '../config/config.service';
import { ProfileClient } from '../profile/profile-client.service';

const BCRYPT_ROUNDS = 12;
const PG_UNIQUE_VIOLATION = '23505';
const USERS_EMAIL_UNIQUE = 'users_email_unique';

// New signups are always plain users; the column defaults to this too.
const NEW_USER_ROLE = 'user';

// Profiles require a non-empty display name (max DISPLAY_NAME_MAX_LENGTH). Seed
// it from the email local-part; the user can rename later via the profile API.
function deriveDisplayName(email: string): string {
    const localPart = email.split('@')[0]?.trim();
    const name = localPart && localPart.length > 0 ? localPart : email;
    return name.slice(0, DISPLAY_NAME_MAX_LENGTH);
}

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
        private readonly profile: ProfileClient,
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

        // A user and their profile are 1:1, so provision the profile here.
        // Best-effort by design: the user record is the source of truth for
        // login and there's no cross-service transaction to roll it back, so a
        // profile failure is logged loudly rather than stranding the account
        // behind an error that re-signup can't get past (ALREADY_EXISTS).
        await this.provisionProfile(saved.id, saved.email);

        return {
            id: saved.id,
            email: saved.email,
            createdAt: saved.created_at.toISOString(),
        };
    }

    private async provisionProfile(userId: string, email: string): Promise<void> {
        try {
            await this.profile.createProfile(
                { displayName: deriveDisplayName(email) },
                { id: userId, role: NEW_USER_ROLE },
            );
            this.logger.debug(`profile provisioned userId=${userId}`);
        } catch (err) {
            this.logger.error(
                `profile provisioning failed userId=${userId} email=${email}; ` +
                    'account exists but has no profile',
                err instanceof Error ? err.stack : String(err),
            );
        }
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
