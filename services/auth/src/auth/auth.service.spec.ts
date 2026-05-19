import { status } from '@grpc/grpc-js';
import { RpcException } from '@nestjs/microservices';
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
            createdAt: '2026-01-01T00:00:00.000Z',
        });
        expect(result).not.toHaveProperty('password_hash');
        expect(result).not.toHaveProperty('passwordHash');
    });

    it('rejects duplicate emails with RpcException(ALREADY_EXISTS)', async () => {
        vi.mocked(users.findByEmail).mockResolvedValue({
            id: 'existing',
            email: 'alice@example.com',
            password_hash: 'irrelevant',
            created_at: new Date(),
            updated_at: new Date(),
        } as UserRow);

        try {
            await service.signup({
                email: 'alice@example.com',
                password: 'correct horse battery',
            });
            expect.fail('expected RpcException');
        } catch (err) {
            expect(err).toBeInstanceOf(RpcException);
            const error = (err as RpcException).getError() as {
                code: number;
                message: string;
            };
            expect(error.code).toBe(status.ALREADY_EXISTS);
        }

        expect(users.insert).not.toHaveBeenCalled();
    });

    it('translates pg unique-violation on insert to RpcException(ALREADY_EXISTS)', async () => {
        // Race: findByEmail clears, but a concurrent signup wins the insert,
        // so ours fails the users_email_unique constraint.
        vi.mocked(users.findByEmail).mockResolvedValue(undefined);
        vi.mocked(users.insert).mockRejectedValue(
            Object.assign(new Error('duplicate key value violates unique constraint'), {
                code: '23505',
                constraint: 'users_email_unique',
            }),
        );

        try {
            await service.signup({
                email: 'alice@example.com',
                password: 'correct horse battery',
            });
            expect.fail('expected RpcException');
        } catch (err) {
            expect(err).toBeInstanceOf(RpcException);
            const error = (err as RpcException).getError() as {
                code: number;
                message: string;
            };
            expect(error.code).toBe(status.ALREADY_EXISTS);
        }
    });
});
