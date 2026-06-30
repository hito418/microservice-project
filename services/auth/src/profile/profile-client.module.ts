import { PROFILE_PROTO_PATH, PROFILE_V1_PACKAGE_NAME } from '@contracts/profile';
import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule } from '../config/config.module';
import { ConfigService } from '../config/config.service';
import { PROFILE_CLIENT, ProfileClient } from './profile-client.service';

/**
 * Registers the profile gRPC client (mirrors the gateway's wiring) and the
 * Promise-based ProfileClient facade, so auth can provision a profile as part
 * of signup.
 */
@Module({
    imports: [
        ClientsModule.registerAsync([
            {
                name: PROFILE_CLIENT,
                imports: [ConfigModule],
                inject: [ConfigService],
                useFactory: (config: ConfigService) => ({
                    transport: Transport.GRPC,
                    options: {
                        package: PROFILE_V1_PACKAGE_NAME,
                        protoPath: PROFILE_PROTO_PATH,
                        url: `${config.profileGrpcHost}:${config.profileGrpcPort}`,
                    },
                }),
            },
        ]),
    ],
    providers: [ProfileClient],
    exports: [ProfileClient],
})
export class ProfileClientModule {}
