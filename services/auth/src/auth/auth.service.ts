import type { SignupRequest, SignupResponse } from '@contracts/auth';
import { status } from '@grpc/grpc-js';
import { Injectable, Logger } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import * as bcrypt from 'bcryptjs';
import { UsersRepository } from '../users/users.repository';

const BCRYPT_ROUNDS = 12;
const PG_UNIQUE_VIOLATION = '23505';
const USERS_EMAIL_UNIQUE = 'users_email_unique';

function isDuplicateEmail(err: unknown): boolean {
    if (typeof err !== 'object' || err === null) return false;
    const e = err as { code?: unknown; constraint?: unknown };
    return e.code === PG_UNIQUE_VIOLATION && e.constraint === USERS_EMAIL_UNIQUE;
}

@Injectable()
export class AuthService {
    private readonly logger = new Logger(AuthService.name);

    constructor(private readonly users: UsersRepository) {}

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
}
