import { status } from '@grpc/grpc-js';
import { RpcException } from '@nestjs/microservices';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProfileRow } from '../db/database.types';
import { ProfileAlreadyExistsError, ProfileRepository } from './profile.repository';
import { ProfileService } from './profile.service';

const USER_ID = '11111111-1111-1111-1111-111111111111';

function makeRepoMock(): ProfileRepository {
    return {
        findByUserId: vi.fn(),
        insert: vi.fn(),
        update: vi.fn(),
        deleteByUserId: vi.fn(),
    } as unknown as ProfileRepository;
}

function profileRow(overrides: Partial<ProfileRow> = {}): ProfileRow {
    return {
        user_id: USER_ID,
        display_name: 'Ada',
        avatar_url: null,
        created_at: new Date('2026-01-01T00:00:00Z'),
        updated_at: new Date('2026-01-01T00:00:00Z'),
        ...overrides,
    };
}

async function rpcErrorOf(
    run: () => Promise<unknown>,
): Promise<{ code: number; message: string }> {
    try {
        await run();
    } catch (err) {
        expect(err).toBeInstanceOf(RpcException);
        return (err as RpcException).getError() as { code: number; message: string };
    }
    throw new Error('expected the call to throw');
}

describe('ProfileService', () => {
    let repo: ProfileRepository;
    let service: ProfileService;

    beforeEach(() => {
        repo = makeRepoMock();
        service = new ProfileService(repo);
    });

    describe('createProfile', () => {
        it('inserts a profile owned by the authenticated user', async () => {
            vi.mocked(repo.insert).mockResolvedValue(
                profileRow({ display_name: 'Ada', avatar_url: 'https://x/a.png' }),
            );

            const result = await service.createProfile(
                { displayName: 'Ada', avatarUrl: 'https://x/a.png' },
                USER_ID,
            );

            expect(repo.insert).toHaveBeenCalledWith({
                userId: USER_ID,
                displayName: 'Ada',
                avatarUrl: 'https://x/a.png',
            });
            expect(result).toEqual({
                userId: USER_ID,
                displayName: 'Ada',
                avatarUrl: 'https://x/a.png',
                createdAt: '2026-01-01T00:00:00.000Z',
                updatedAt: '2026-01-01T00:00:00.000Z',
            });
        });

        it('maps a duplicate profile to ALREADY_EXISTS', async () => {
            vi.mocked(repo.insert).mockRejectedValue(
                new ProfileAlreadyExistsError(USER_ID),
            );

            const error = await rpcErrorOf(() =>
                service.createProfile({ displayName: 'Ada' }, USER_ID),
            );

            expect(error.code).toBe(status.ALREADY_EXISTS);
        });
    });

    describe('getProfile', () => {
        it('returns the profile when found', async () => {
            vi.mocked(repo.findByUserId).mockResolvedValue(profileRow());

            const result = await service.getProfile({ userId: USER_ID });

            expect(result.userId).toBe(USER_ID);
            expect(result.avatarUrl).toBeUndefined();
        });

        it('throws NOT_FOUND when missing', async () => {
            vi.mocked(repo.findByUserId).mockResolvedValue(undefined);

            const error = await rpcErrorOf(() =>
                service.getProfile({ userId: USER_ID }),
            );

            expect(error.code).toBe(status.NOT_FOUND);
        });
    });

    describe('updateProfile', () => {
        it('clears the avatar when given an empty string', async () => {
            vi.mocked(repo.update).mockResolvedValue(profileRow());

            await service.updateProfile({ avatarUrl: '' }, USER_ID);

            expect(repo.update).toHaveBeenCalledWith(USER_ID, {
                displayName: undefined,
                avatarUrl: null,
            });
        });

        it('leaves the avatar unchanged when omitted', async () => {
            vi.mocked(repo.update).mockResolvedValue(profileRow());

            await service.updateProfile({ displayName: 'Grace' }, USER_ID);

            expect(repo.update).toHaveBeenCalledWith(USER_ID, {
                displayName: 'Grace',
                avatarUrl: undefined,
            });
        });

        it('throws NOT_FOUND when the profile does not exist', async () => {
            vi.mocked(repo.update).mockResolvedValue(undefined);

            const error = await rpcErrorOf(() =>
                service.updateProfile({ displayName: 'Grace' }, USER_ID),
            );

            expect(error.code).toBe(status.NOT_FOUND);
        });
    });

    describe('deleteProfile', () => {
        it('returns the user id when deleted', async () => {
            vi.mocked(repo.deleteByUserId).mockResolvedValue(true);

            const result = await service.deleteProfile(USER_ID);

            expect(result).toEqual({ userId: USER_ID });
        });

        it('throws NOT_FOUND when nothing was deleted', async () => {
            vi.mocked(repo.deleteByUserId).mockResolvedValue(false);

            const error = await rpcErrorOf(() => service.deleteProfile(USER_ID));

            expect(error.code).toBe(status.NOT_FOUND);
        });
    });
});
