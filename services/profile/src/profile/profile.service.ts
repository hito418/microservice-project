import { Injectable } from '@nestjs/common';
import type {
    ApplyPlayerStatsDeltaRequest,
    CreateProfileRequest,
    DeleteProfileResponse,
    GetProfileRequest,
    GetPlayerStatsRequest,
    ListTopPlayerStatsRequest,
    ListTopPlayerStatsResponse,
    PlayerStatsResponse,
    ProfileResponse,
    UpdateProfileRequest,
    UpsertPlayerStatsRequest,
} from '@contracts/profile';
import { status } from '@grpc/grpc-js';
import { RpcException } from '@nestjs/microservices';
import type { PlayerStatsRow, ProfileRow } from '../db/database.types';
import {
    ProfileAlreadyExistsError,
    ProfileRepository,
} from './profile.repository';
import { deriveRankTierFromElo } from './rank-tier';

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

    async getPlayerStats(
        request: GetPlayerStatsRequest,
    ): Promise<PlayerStatsResponse> {
        const stats = await this.profileRepository.findStatsByUserId(
            request.userId,
        );
        if (!stats) {
            throw new RpcException({
                code: status.NOT_FOUND,
                message: `Player stats for user ${request.userId} were not found`,
            });
        }
        return toStatsResponse(stats);
    }

    async listTopPlayerStats(
        request: ListTopPlayerStatsRequest,
    ): Promise<ListTopPlayerStatsResponse> {
        const limit = request.limit ?? 10;
        const stats = await this.profileRepository.listTopStats(limit);
        return { items: stats.map(toStatsResponse) };
    }

    async upsertPlayerStats(
        request: UpsertPlayerStatsRequest,
    ): Promise<PlayerStatsResponse> {
        ensureNonNegative('xp', request.xp);
        ensureNonNegative('elo', request.elo);
        ensureNonNegative('debatesCount', request.debatesCount);
        ensureNonNegative('wins', request.wins);
        ensureNonNegative('losses', request.losses);
        ensureNonNegative('draws', request.draws);
        ensureCountsMatch({
            debatesCount: request.debatesCount,
            wins: request.wins,
            losses: request.losses,
            draws: request.draws,
        });

        const stats = await this.profileRepository.upsertStats({
            userId: request.userId,
            xp: request.xp,
            elo: request.elo,
            debatesCount: request.debatesCount,
            wins: request.wins,
            losses: request.losses,
            draws: request.draws,
        });
        return toStatsResponse(stats);
    }

    async applyPlayerStatsDelta(
        request: ApplyPlayerStatsDeltaRequest,
    ): Promise<PlayerStatsResponse> {
        ensureNonNegative('xpDelta', request.xpDelta);
        if (!isPlayerStatsResult(request.result)) {
            throw invalidArgument('result must be one of WIN, LOSS, DRAW');
        }

        const current = await this.profileRepository.findStatsByUserId(
            request.userId,
        );
        const currentElo = current?.elo ?? 1000;
        if (currentElo + request.eloDelta < 0) {
            throw invalidArgument('final elo must not be negative');
        }

        const stats = await this.profileRepository.applyStatsDelta({
            userId: request.userId,
            xpDelta: request.xpDelta,
            eloDelta: request.eloDelta,
            result: request.result,
        });
        return toStatsResponse(stats);
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

function toStatsResponse(stats: PlayerStatsRow): PlayerStatsResponse {
    return {
        userId: stats.user_id,
        xp: stats.xp,
        elo: stats.elo,
        debatesCount: stats.debates_count,
        wins: stats.wins,
        losses: stats.losses,
        draws: stats.draws,
        winrate: winrate(stats.wins, stats.debates_count),
        createdAt: stats.created_at.toISOString(),
        updatedAt: stats.updated_at.toISOString(),
        rankTier: deriveRankTierFromElo(stats.elo),
    };
}

function winrate(wins: number, debatesCount: number): number {
    if (debatesCount === 0) return 0;
    return Math.round((wins / debatesCount) * 100);
}

function ensureCountsMatch(input: {
    debatesCount: number;
    wins: number;
    losses: number;
    draws: number;
}): void {
    if (input.debatesCount !== input.wins + input.losses + input.draws) {
        throw invalidArgument('debatesCount must equal wins + losses + draws');
    }
}

function ensureNonNegative(fieldName: string, value: number): void {
    if (!Number.isInteger(value) || value < 0) {
        throw invalidArgument(`${fieldName} must be a non-negative integer`);
    }
}

function isPlayerStatsResult(result: string): result is 'WIN' | 'LOSS' | 'DRAW' {
    return result === 'WIN' || result === 'LOSS' || result === 'DRAW';
}

function invalidArgument(message: string): RpcException {
    return new RpcException({
        code: status.INVALID_ARGUMENT,
        message,
    });
}
