import {
    type CreateProfileRequest,
    createProfileSchema,
    type DeleteProfileResponse,
    deleteProfileSchema,
    type GetProfileRequest,
    getProfileSchema,
    type ProfileResponse,
    type ProfileServiceController,
    ProfileServiceControllerMethods,
    type UpdateProfileRequest,
    updateProfileSchema,
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
}
