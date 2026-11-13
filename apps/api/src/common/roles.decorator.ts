/** Decorators that mark routes as public or restrict them to roles. */
import { SetMetadata } from '@nestjs/common';
import { Role } from '@prisma/client';

// Metadata key under which allowed roles are stored
export const ROLES_KEY = 'roles';
// Metadata key that marks a route as public
export const IS_PUBLIC_KEY = 'isPublic';

/** Restrict a route to the given roles. Routes without @Roles only need a valid login. */
// Usage: @Roles('SUPER_ADMIN') above a route
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
/** Skip authentication entirely (login, catalog, webhooks). */
// Usage: @Public() above a route to skip login
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

// Shortcut role group: admin users
export const ADMINS: Role[] = ['OPS_ADMIN', 'SUPER_ADMIN'];
// Shortcut role group: kitchen + admin users
export const STAFF: Role[] = ['OPERATIONS', 'OPS_ADMIN', 'SUPER_ADMIN'];
