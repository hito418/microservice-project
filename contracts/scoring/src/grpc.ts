import * as path from 'node:path';

/**
 * Absolute path to the scoring.proto file shipped with this package.
 * Use as `protoPath` when registering the gRPC microservice / client.
 *
 * Package/service name constants come from `./generated/scoring`
 * (SCORING_V1_PACKAGE_NAME, SCORING_SERVICE_NAME) — generated from the .proto.
 */
export const SCORING_PROTO_PATH = path.join(
    __dirname,
    '..',
    'proto',
    'scoring.proto',
);
