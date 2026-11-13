/** Global guard that enforces @Roles(...) on every route. */
import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { ROLES_KEY } from './roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}
  // Runs on every request after JwtAuthGuard
  canActivate(context: ExecutionContext): boolean {
    // Roles required by the route (or controller)
    const roles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [context.getHandler(), context.getClass()]);
    // No @Roles = any logged-in user may enter
    if (!roles || roles.length === 0) return true;
    // Logged-in user set by the JWT strategy
    const user = context.switchToHttp().getRequest().user;
    // Reject (403) when the user's role is not allowed
    if (!user || !roles.includes(user.role)) throw new ForbiddenException('Your role cannot do this');
    return true;
  }
}
