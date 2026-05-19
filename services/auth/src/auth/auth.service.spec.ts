import { ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UserRow } from '../db/database.types';
import { UsersRepository } from '../users/users.repository';
import { AuthService } from './auth.service';

function makeUsersRepoMock(): UsersRepository {
    return {
        findByEmail: vi.fn(),
        insert: vi.fn(),
    } as unknown as UsersRepository;
}

describe('AuthService.signup', () => {
    let users: UsersRepository;
    let service: AuthService;

    beforeEach(() => {
        users = makeUsersRepoMock();
        service = new AuthService(users);
    });

    it('hashes the password and persists a normalized email', async () => {
        vi.mocked(users.findByEmail).mockResolvedValue(undefined);
        vi.mocked(users.insert).mockImplementation(async (input) => ({
            id: 'user-1',
            email: input.email,
            password_hash: input.passwordHash,
            created_at: new Date('2026-01-01T00:00:00Z'),
            updated_at: new Date('2026-01-01T00:00:00Z'),
        }));

        const result = await service.signup({
            email: '  Alice@Example.com ',
            password: 'correct horse battery',
        });

        expect(users.findByEmail).toHaveBeenCalledWith('alice@example.com');

        const insertArg = vi.mocked(users.insert).mock.calls[0][0];
        expect(insertArg.email).toBe('alice@example.com');
        expect(insertArg.passwordHash).not.toBe('correct horse battery');
        expect(
            await bcrypt.compare('correct horse battery', insertArg.passwordHash),
        ).toBe(true);

        expect(result).toEqual({
            id: 'user-1',
            email: 'alice@example.com',
            createdAt: new Date('2026-01-01T00:00:00Z'),
        });
        expect(result).not.toHaveProperty('password_hash');
        expect(result).not.toHaveProperty('passwordHash');
    });

    it('rejects duplicate emails with ConflictException', async () => {
        vi.mocked(users.findByEmail).mockResolvedValue({
            id: 'existing',
            email: 'alice@example.com',
            password_hash: 'irrelevant',
            created_at: new Date(),
            updated_at: new Date(),
        } as UserRow);

        await expect(
            service.signup({
                email: 'alice@example.com',
                password: 'correct horse battery',
            }),
        ).rejects.toBeInstanceOf(ConflictException);

        expect(users.insert).not.toHaveBeenCalled();
    });
});
