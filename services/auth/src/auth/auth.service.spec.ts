import { ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { User } from '../users/user.entity';
import { AuthService } from './auth.service';

function makeRepoMock(): Repository<User> {
    const repo = {
        findOne: vi.fn(),
        create: vi.fn((data: Partial<User>) => data as User),
        save: vi.fn(),
    };
    return repo as unknown as Repository<User>;
}

describe('AuthService.signup', () => {
    let repo: Repository<User>;
    let service: AuthService;

    beforeEach(() => {
        repo = makeRepoMock();
        service = new AuthService(repo);
    });

    it('hashes the password and persists a normalized email', async () => {
        vi.mocked(repo.findOne).mockResolvedValue(null);
        vi.mocked(repo.save).mockImplementation(async (entity) => ({
            ...(entity as User),
            id: 'user-1',
            createdAt: new Date('2026-01-01T00:00:00Z'),
            updatedAt: new Date('2026-01-01T00:00:00Z'),
        }));

        const result = await service.signup({
            email: '  Alice@Example.com ',
            password: 'correct horse battery',
        });

        expect(repo.findOne).toHaveBeenCalledWith({
            where: { email: 'alice@example.com' },
        });
        const savedArg = vi.mocked(repo.save).mock.calls[0][0] as User;
        expect(savedArg.email).toBe('alice@example.com');
        expect(savedArg.passwordHash).not.toBe('correct horse battery');
        expect(
            await bcrypt.compare('correct horse battery', savedArg.passwordHash),
        ).toBe(true);

        expect(result).toEqual({
            id: 'user-1',
            email: 'alice@example.com',
            createdAt: new Date('2026-01-01T00:00:00Z'),
        });
        expect(result).not.toHaveProperty('passwordHash');
        expect(result).not.toHaveProperty('password');
    });

    it('rejects duplicate emails with ConflictException', async () => {
        vi.mocked(repo.findOne).mockResolvedValue({
            id: 'existing',
            email: 'alice@example.com',
        } as User);

        await expect(
            service.signup({
                email: 'alice@example.com',
                password: 'correct horse battery',
            }),
        ).rejects.toBeInstanceOf(ConflictException);

        expect(repo.save).not.toHaveBeenCalled();
    });
});
