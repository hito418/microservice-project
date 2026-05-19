import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { AuthenticatedRequest } from './authenticated-user';
import { AuthUserGuard } from './auth-user.guard';

function createHttpContext(request: AuthenticatedRequest): ExecutionContext {
    return {
        switchToHttp: () => ({
            getRequest: () => request,
        }),
    } as unknown as ExecutionContext;
}

describe('AuthUserGuard', () => {
    it('rejects a request without authenticated user header', () => {
        const guard = new AuthUserGuard();
        const request: AuthenticatedRequest = { headers: {} };

        assert.throws(
            () => guard.canActivate(createHttpContext(request)),
            UnauthorizedException,
        );
    });

    it('stores the current user from x-user-id', () => {
        const guard = new AuthUserGuard();
        const request: AuthenticatedRequest = {
            headers: { 'x-user-id': ' user-1 ' },
        };

        assert.equal(guard.canActivate(createHttpContext(request)), true);
        assert.deepEqual(request.user, { id: 'user-1' });
    });
});
