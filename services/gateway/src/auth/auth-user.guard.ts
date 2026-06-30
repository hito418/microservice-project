import {
    CanActivate,
    ExecutionContext,
    ForbiddenException,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '../config/config.service';
import {
    type AuthenticatedRequest,
    isRole,
    type JwtAccessPayload,
    type Role,
} from './authenticated-user';
import { ROLES_KEY } from './roles.decorator';

@Injectable()
export class AuthUserGuard implements CanActivate {
    constructor(
        private readonly jwt: JwtService,
        private readonly config: ConfigService,
        private readonly reflector: Reflector,
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
        const token = request.cookies?.[this.config.authCookieName];

        if (typeof token !== 'string' || token.trim().length === 0) {
            throw new UnauthorizedException('Authentication cookie is required');
        }

        let payload: JwtAccessPayload;
        try {
            // Verify with the public key only; pin the algorithm so a forged
            // token can't downgrade us into HS256-with-the-public-key.
            payload = await this.jwt.verifyAsync<JwtAccessPayload>(token, {
                publicKey: this.config.jwtPublicKey,
                algorithms: [this.config.jwtAlgorithm],
            });
        } catch {
            throw new UnauthorizedException('Invalid or expired authentication token');
        }

        if (typeof payload.sub !== 'string' || !isRole(payload.role)) {
            throw new UnauthorizedException('Malformed authentication token');
        }

        const requiredRoles = this.reflector.getAllAndOverride<Role[] | undefined>(
            ROLES_KEY,
            [context.getHandler(), context.getClass()],
        );

        if (requiredRoles && requiredRoles.length > 0 && !requiredRoles.includes(payload.role)) {
            throw new ForbiddenException('Insufficient role');
        }

        request.user = { id: payload.sub, role: payload.role };
        return true;
    }
}
