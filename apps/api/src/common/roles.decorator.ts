/** Decorators that mark routes as public or restrict them to roles. */
import { SetMetadata } from '@nestjs/common';
import { Role } from '@prisma/client';

export const ROLES_KEY = 'roles';
export const IS_PUBLIC_KEY = 'isPublic';

/** Restrict a route to the given roles. Routes without @Roles only need a valid login. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
/** Skip authentication entirely (login, catalog, webhooks). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const ADMINS: Role[] = ['OPS_ADMIN', 'SUPER_ADMIN'];
export const STAFF: Role[] = ['OPERATIONS', 'OPS_ADMIN', 'SUPER_ADMIN'];
