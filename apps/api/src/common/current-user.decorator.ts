/** Parameter decorator that gives a handler the logged-in user. */
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Role } from '@prisma/client';

// Shape of the logged-in user attached to the request by the JWT strategy
export interface AuthUser {
  id: string;
  role: Role;
  name: string;
  // Only present when role is CUSTOMER
  customerId?: string;
}

// Use as @CurrentUser() user in a controller method to get the logged-in user
export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUser => {
  // req.user is filled in by JwtStrategy.validate
  return ctx.switchToHttp().getRequest().user;
});
