import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { AuthenticatedRequest } from './authenticated-user';

@Injectable()
export class AuthUserGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
        const userIdHeader = request.headers['x-user-id'];
        const userId = Array.isArray(userIdHeader) ? userIdHeader[0] : userIdHeader;

        if (typeof userId !== 'string' || userId.trim().length === 0) {
            throw new UnauthorizedException('Authenticated user is required');
        }

        request.user = { id: userId.trim() };
        return true;
    }
}
