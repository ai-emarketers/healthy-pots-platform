/** Reads the login token from the cookie (or a Bearer header) and loads the user. */
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/current-user.decorator';

export const COOKIE_NAME = 'hp_token';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req) => req?.cookies?.[COOKIE_NAME] ?? null,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET,
    });
  }

  async validate(payload: { sub: string }): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub }, include: { customer: true } });
    if (!user || !user.active) throw new UnauthorizedException();
    return { id: user.id, role: user.role, name: user.name, customerId: user.customer?.id };
  }
}
