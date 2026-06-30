import {
    type CreateProfileRequest,
    PROFILE_SERVICE_NAME,
    type ProfileResponse,
    type ProfileServiceClient,
} from '@contracts/profile';
import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import { type ClientGrpc } from '@nestjs/microservices';
import { attachUserMetadata, type GrpcPrincipal } from '@repo/common/grpc';
import { lastValueFrom } from 'rxjs';

export const PROFILE_CLIENT = 'PROFILE_CLIENT';

/**
 * Promise-returning facade over the profile gRPC client so callers never touch
 * RxJS. Only the methods auth needs are exposed.
 */
@Injectable()
export class ProfileClient implements OnModuleInit {
    private profile!: ProfileServiceClient;

    constructor(@Inject(PROFILE_CLIENT) private readonly client: ClientGrpc) {}

    onModuleInit(): void {
        this.profile =
            this.client.getService<ProfileServiceClient>(PROFILE_SERVICE_NAME);
    }

    /**
     * Profile create is owner-scoped: the owning principal rides as gRPC
     * metadata (x-user-id/x-user-role), not in the request body.
     */
    createProfile(
        request: CreateProfileRequest,
        owner: GrpcPrincipal,
    ): Promise<ProfileResponse> {
        return lastValueFrom(
            this.profile.createProfile(request, attachUserMetadata(owner)),
        );
    }
}
