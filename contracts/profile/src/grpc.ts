import * as path from 'node:path';

/**
 * Absolute path to the profile.proto file shipped with this package.
 * Use as `protoPath` when registering the gRPC microservice / client.
 *
 * Package/service name constants come from `./generated/profile`
 * (PROFILE_V1_PACKAGE_NAME, PROFILE_SERVICE_NAME) — generated from the .proto.
 */
export const PROFILE_PROTO_PATH = path.join(
    __dirname,
    '..',
    'proto',
    'profile.proto',
);
