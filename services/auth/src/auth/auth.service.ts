import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { SignupDto } from './dto/signup.dto';

const BCRYPT_ROUNDS = 12;

export interface PublicUser {
    id: string;
    email: string;
    createdAt: Date;
}

@Injectable()
export class AuthService {
    constructor(
        @InjectRepository(User)
        private readonly users: Repository<User>,
    ) {}

    async signup({ email, password }: SignupDto): Promise<PublicUser> {
        const normalizedEmail = email.trim().toLowerCase();

        const existing = await this.users.findOne({
            where: { email: normalizedEmail },
        });
        if (existing) {
            throw new ConflictException('email already registered');
        }

        const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

        const user = this.users.create({
            email: normalizedEmail,
            passwordHash,
        });
        const saved = await this.users.save(user);

        return { id: saved.id, email: saved.email, createdAt: saved.createdAt };
    }
}
