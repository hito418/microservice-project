import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import type { AuthenticatedRequest, AuthenticatedUser } from './authenticated-user';

export const CurrentUser = createParamDecorator(
    (_data: unknown, context: ExecutionContext): AuthenticatedUser => {
        const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

        if (!request.user) {
            throw new UnauthorizedException('Authenticated user is required');
        }

        return request.user;
    },
);
