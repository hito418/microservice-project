import { generateKeyPairSync } from 'node:crypto';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { AuthUserGuard } from './auth-user.guard';
import type { AuthenticatedRequest, Role } from './authenticated-user';
import { ROLES_KEY } from './roles.decorator';

const COOKIE_NAME = 'auth_token';

// EC P-256 keypair so the guard exercises real ES256 verification.
const { privateKey, publicKey } = generateKeyPairSync('ec', {
    namedCurve: 'P-256',
});
const privatePem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
const publicPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();

const jwt = new JwtService();
const config = {
    authCookieName: COOKIE_NAME,
    jwtPublicKey: publicPem,
    jwtAlgorithm: 'ES256' as const,
};

function sign(payload: object, opts: { algorithm?: string; key?: string } = {}): string {
    return jwt.sign(payload, {
        algorithm: (opts.algorithm ?? 'ES256') as never,
        privateKey: opts.key ?? privatePem,
    });
}

function createContext(
    request: AuthenticatedRequest,
    requiredRoles?: Role[],
): ExecutionContext {
    const handler = () => undefined;
    const cls = class {};
    return {
        switchToHttp: () => ({ getRequest: () => request }),
        getHandler: () => handler,
        getClass: () => cls,
        // Reflector reads metadata off the handler/class; stub it here.
        __roles: requiredRoles,
    } as unknown as ExecutionContext;
}

function createGuard(requiredRoles?: Role[]): AuthUserGuard {
    const reflector = {
        getAllAndOverride: () => requiredRoles,
    } as unknown as Reflector;
    return new AuthUserGuard(jwt, config as never, reflector);
}

describe('AuthUserGuard', () => {
    it('rejects a request without an auth cookie', async () => {
        const guard = createGuard();
        const request: AuthenticatedRequest = { headers: {}, cookies: {} };

        await assert.rejects(
            () => guard.canActivate(createContext(request)),
            UnauthorizedException,
        );
    });

    it('rejects a tampered / invalid token', async () => {
        const guard = createGuard();
        const request: AuthenticatedRequest = {
            headers: {},
            cookies: { [COOKIE_NAME]: 'not-a-jwt' },
        };

        await assert.rejects(
            () => guard.canActivate(createContext(request)),
            UnauthorizedException,
        );
    });

    it('rejects a token signed with the wrong key', async () => {
        const other = generateKeyPairSync('ec', { namedCurve: 'P-256' });
        const otherPem = other.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
        const guard = createGuard();
        const request: AuthenticatedRequest = {
            headers: {},
            cookies: { [COOKIE_NAME]: sign({ sub: 'user-1', role: 'user' }, { key: otherPem }) },
        };

        await assert.rejects(
            () => guard.canActivate(createContext(request)),
            UnauthorizedException,
        );
    });

    it('stores the current user from a valid cookie token', async () => {
        const guard = createGuard();
        const request: AuthenticatedRequest = {
            headers: {},
            cookies: { [COOKIE_NAME]: sign({ sub: 'user-1', role: 'user' }) },
        };

        assert.equal(await guard.canActivate(createContext(request)), true);
        assert.deepEqual(request.user, { id: 'user-1', role: 'user' });
    });

    it('allows a matching required role', async () => {
        const guard = createGuard(['admin']);
        const request: AuthenticatedRequest = {
            headers: {},
            cookies: { [COOKIE_NAME]: sign({ sub: 'admin-1', role: 'admin' }) },
        };

        assert.equal(await guard.canActivate(createContext(request)), true);
        assert.deepEqual(request.user, { id: 'admin-1', role: 'admin' });
    });

    it('forbids a mismatched required role', async () => {
        const guard = createGuard(['admin']);
        const request: AuthenticatedRequest = {
            headers: {},
            cookies: { [COOKIE_NAME]: sign({ sub: 'user-1', role: 'user' }) },
        };

        await assert.rejects(
            () => guard.canActivate(createContext(request)),
            ForbiddenException,
        );
    });
});

// Reference ROLES_KEY so the metadata-key contract stays covered by the build.
assert.equal(ROLES_KEY, 'roles');
