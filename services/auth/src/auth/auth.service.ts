import { ConflictException, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { UsersRepository } from '../users/users.repository';
import { SignupDto } from './dto/signup.dto';

const BCRYPT_ROUNDS = 12;

export interface PublicUser {
    id: string;
    email: string;
    createdAt: Date;
}

@Injectable()
export class AuthService {
    constructor(private readonly users: UsersRepository) {}

    async signup({ email, password }: SignupDto): Promise<PublicUser> {
        const normalizedEmail = email.trim().toLowerCase();

        const existing = await this.users.findByEmail(normalizedEmail);
        if (existing) {
            throw new ConflictException('email already registered');
        }

        const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

        const saved = await this.users.insert({
            email: normalizedEmail,
            passwordHash,
        });

        return {
            id: saved.id,
            email: saved.email,
            createdAt: saved.created_at,
        };
    }
}
