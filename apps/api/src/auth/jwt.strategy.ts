/** Reads the login token from the cookie (or a Bearer header) and loads the user. */
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/current-user.decorator';

// Name of the login cookie
export const COOKIE_NAME = 'hp_token';

@Injectable()
// Verifies the token on every request and loads the user
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private prisma: PrismaService) {
    super({
      // Token is read from the cookie first, then from an "Authorization: Bearer" header (handy for Swagger/tools)
      jwtFromRequest: ExtractJwt.fromExtractors([
        // Cookie extractor
        (req) => req?.cookies?.[COOKIE_NAME] ?? null,
        // Header extractor
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      // Expired tokens are rejected
      ignoreExpiration: false,
      // Same secret used to sign the token
      secretOrKey: process.env.JWT_SECRET,
    });
  }

  // Runs after the signature is verified
  async validate(payload: { sub: string }): Promise<AuthUser> {
    // Re-load the user so deactivated accounts lose access immediately
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub }, include: { customer: true } });
    // Deactivated or deleted user -> 401
    if (!user || !user.active) throw new UnauthorizedException();
    // This object becomes req.user (see @CurrentUser)
    return { id: user.id, role: user.role, name: user.name, customerId: user.customer?.id };
  }
}
