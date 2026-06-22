import { Metadata, status } from '@grpc/grpc-js';
import {
    createParamDecorator,
    type ExecutionContext,
} from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';

// gRPC metadata keys carrying the authenticated principal across services.
// Keys must be lowercase; values are plain ASCII strings (no `-bin` suffix).
export const USER_ID_METADATA_KEY = 'x-user-id';
export const USER_ROLE_METADATA_KEY = 'x-user-role';

// The caller identity as it travels between services. Kept deliberately
// minimal and string-typed — each service narrows `role` to its own enum.
export type GrpcPrincipal = {
    id: string;
    role: string;
};

// Client side: stamp the principal onto outbound call metadata. Pass an
// existing Metadata to extend it, or let it create a fresh one.
export function attachUserMetadata(
    principal: GrpcPrincipal,
    metadata: Metadata = new Metadata(),
): Metadata {
    metadata.set(USER_ID_METADATA_KEY, principal.id);
    metadata.set(USER_ROLE_METADATA_KEY, principal.role);
    return metadata;
}

function firstValue(metadata: Metadata, key: string): string | undefined {
    const value = metadata.get(key)[0];
    if (value === undefined) return undefined;
    return typeof value === 'string' ? value : value.toString();
}

// Server side: read the principal back out. Returns null when either field
// is absent so callers decide whether the route requires it.
export function readUserMetadata(metadata: Metadata): GrpcPrincipal | null {
    const id = firstValue(metadata, USER_ID_METADATA_KEY);
    const role = firstValue(metadata, USER_ROLE_METADATA_KEY);
    if (!id || !role) return null;
    return { id, role };
}

// Param decorator for gRPC handlers: `@GrpcUser() user: GrpcPrincipal`.
// Throws UNAUTHENTICATED when the metadata is missing — apply it only on
// routes the gateway authenticates.
export const GrpcUser = createParamDecorator(
    (_data: unknown, context: ExecutionContext): GrpcPrincipal => {
        const metadata = context.switchToRpc().getContext<Metadata>();
        const principal = readUserMetadata(metadata);
        if (!principal) {
            throw new RpcException({
                code: status.UNAUTHENTICATED,
                message: 'Authenticated user metadata is required',
            });
        }
        return principal;
    },
);
