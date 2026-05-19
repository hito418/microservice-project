import * as path from 'node:path';

/**
 * Absolute path to the auth.proto file shipped with this package.
 * Use as `protoPath` when registering the gRPC microservice / client.
 *
 * Package/service name constants come from `./generated/auth`
 * (AUTH_V1_PACKAGE_NAME, AUTH_SERVICE_NAME) — generated from the .proto.
 */
export const AUTH_PROTO_PATH = path.join(
    __dirname,
    '..',
    'proto',
    'auth.proto',
);
