/** Global guard that requires a valid login on every route except @Public() ones. */
import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from './roles.decorator';

@Injectable()
// Uses the 'jwt' passport strategy (see auth/jwt.strategy.ts)
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }
  // Runs before every route handler
  canActivate(context: ExecutionContext) {
    // Checks if the route (or its controller) is marked @Public()
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    // Public routes skip authentication
    if (isPublic) return true;
    // Otherwise require a valid JWT
    return super.canActivate(context);
  }
}
