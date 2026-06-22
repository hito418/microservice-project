import {
    type ApplyPlayerStatsDeltaRequest,
    applyPlayerStatsDeltaSchema,
    type CreateProfileRequest,
    createProfileSchema,
    type DeleteProfileResponse,
    deleteProfileSchema,
    type GetProfileRequest,
    getProfileSchema,
    type GetPlayerStatsRequest,
    getPlayerStatsSchema,
    type PlayerStatsResponse,
    type ProfileResponse,
    type ProfileServiceController,
    ProfileServiceControllerMethods,
    type UpdateProfileRequest,
    updateProfileSchema,
    type UpsertPlayerStatsRequest,
    upsertPlayerStatsSchema,
} from '@contracts/profile';
import { Controller } from '@nestjs/common';
import { Payload } from '@nestjs/microservices';
import { GrpcUser, type GrpcPrincipal } from '@repo/common/grpc';
import { ZodRpcValidationPipe } from '@repo/common/pipes';
import { ProfileService } from './profile.service';

@Controller()
@ProfileServiceControllerMethods()
export class ProfileController implements ProfileServiceController {
    constructor(private readonly profileService: ProfileService) {}

    createProfile(
        @Payload(new ZodRpcValidationPipe(createProfileSchema))
        request: CreateProfileRequest,
        @GrpcUser() user: GrpcPrincipal,
    ): Promise<ProfileResponse> {
        return this.profileService.createProfile(request, user.id);
    }

    getProfile(
        @Payload(new ZodRpcValidationPipe(getProfileSchema))
        request: GetProfileRequest,
    ): Promise<ProfileResponse> {
        return this.profileService.getProfile(request);
    }

    updateProfile(
        @Payload(new ZodRpcValidationPipe(updateProfileSchema))
        request: UpdateProfileRequest,
        @GrpcUser() user: GrpcPrincipal,
    ): Promise<ProfileResponse> {
        return this.profileService.updateProfile(request, user.id);
    }

    deleteProfile(
        @Payload(new ZodRpcValidationPipe(deleteProfileSchema))
        _request: unknown,
        @GrpcUser() user: GrpcPrincipal,
    ): Promise<DeleteProfileResponse> {
        return this.profileService.deleteProfile(user.id);
    }

    getPlayerStats(
        @Payload(new ZodRpcValidationPipe(getPlayerStatsSchema))
        request: GetPlayerStatsRequest,
    ): Promise<PlayerStatsResponse> {
        return this.profileService.getPlayerStats(request);
    }

    upsertPlayerStats(
        @Payload(new ZodRpcValidationPipe(upsertPlayerStatsSchema))
        request: UpsertPlayerStatsRequest,
    ): Promise<PlayerStatsResponse> {
        return this.profileService.upsertPlayerStats(request);
    }

    applyPlayerStatsDelta(
        @Payload(new ZodRpcValidationPipe(applyPlayerStatsDeltaSchema))
        request: ApplyPlayerStatsDeltaRequest,
    ): Promise<PlayerStatsResponse> {
        return this.profileService.applyPlayerStatsDelta(request);
    }
}
