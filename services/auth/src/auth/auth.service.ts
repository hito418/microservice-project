import type { SignupRequest, SignupResponse } from '@contracts/auth';
import { status } from '@grpc/grpc-js';
import { Injectable, Logger } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import * as bcrypt from 'bcryptjs';
import { UsersRepository } from '../users/users.repository';

const BCRYPT_ROUNDS = 12;

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

        const saved = await this.users.insert({
            email: normalizedEmail,
            passwordHash,
        });

        this.logger.debug(`signup ok id=${saved.id} email=${saved.email}`);

        return {
            id: saved.id,
            email: saved.email,
            createdAt: saved.created_at.toISOString(),
        };
    }
}
