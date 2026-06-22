import { Injectable } from '@nestjs/common';
import type {
    CreateProfileRequest,
    DeleteProfileResponse,
    GetProfileRequest,
    ProfileResponse,
    UpdateProfileRequest,
} from '@contracts/profile';
import { status } from '@grpc/grpc-js';
import { RpcException } from '@nestjs/microservices';
import type { ProfileRow } from '../db/database.types';
import {
    ProfileAlreadyExistsError,
    ProfileRepository,
} from './profile.repository';

@Injectable()
export class ProfileService {
    constructor(private readonly profileRepository: ProfileRepository) {}

    async createProfile(
        request: CreateProfileRequest,
        userId: string,
    ): Promise<ProfileResponse> {
        try {
            const profile = await this.profileRepository.insert({
                userId,
                displayName: request.displayName,
                avatarUrl: request.avatarUrl ?? null,
            });
            return toResponse(profile);
        } catch (error) {
            if (error instanceof ProfileAlreadyExistsError) {
                throw new RpcException({
                    code: status.ALREADY_EXISTS,
                    message: error.message,
                });
            }
            throw error;
        }
    }

    async getProfile(request: GetProfileRequest): Promise<ProfileResponse> {
        const profile = await this.profileRepository.findByUserId(request.userId);
        if (!profile) {
            throw new RpcException({
                code: status.NOT_FOUND,
                message: `Profile for user ${request.userId} was not found`,
            });
        }
        return toResponse(profile);
    }

    async updateProfile(
        request: UpdateProfileRequest,
        userId: string,
    ): Promise<ProfileResponse> {
        const profile = await this.profileRepository.update(userId, {
            displayName: request.displayName,
            // An empty string clears the avatar; `undefined` leaves it unchanged.
            avatarUrl:
                request.avatarUrl === undefined
                    ? undefined
                    : request.avatarUrl === ''
                      ? null
                      : request.avatarUrl,
        });
        if (!profile) {
            throw new RpcException({
                code: status.NOT_FOUND,
                message: `Profile for user ${userId} was not found`,
            });
        }
        return toResponse(profile);
    }

    async deleteProfile(userId: string): Promise<DeleteProfileResponse> {
        const deleted = await this.profileRepository.deleteByUserId(userId);
        if (!deleted) {
            throw new RpcException({
                code: status.NOT_FOUND,
                message: `Profile for user ${userId} was not found`,
            });
        }
        return { userId };
    }
}

function toResponse(profile: ProfileRow): ProfileResponse {
    return {
        userId: profile.user_id,
        displayName: profile.display_name,
        avatarUrl: profile.avatar_url ?? undefined,
        createdAt: profile.created_at.toISOString(),
        updatedAt: profile.updated_at.toISOString(),
    };
}
