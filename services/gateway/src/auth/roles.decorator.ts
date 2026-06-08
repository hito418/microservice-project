import { SetMetadata } from '@nestjs/common';
import type { Role } from './authenticated-user';

export const ROLES_KEY = 'roles';

// Restrict a route (or controller) to one or more roles. Without it, any
// authenticated user passes AuthUserGuard.
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
