/** Auth feature module (JWT setup). */
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';

// Auth feature wiring
@Module({
  imports: [
    // Passport = pluggable authentication library
    PassportModule,
    // Signs tokens with JWT_SECRET; tokens expire after 7 days
    JwtModule.register({ secret: process.env.JWT_SECRET, signOptions: { expiresIn: '7d' } }),
  ],
  // Routes
  controllers: [AuthController],
  // Login logic + token verification
  providers: [AuthService, JwtStrategy],
  // Other modules may reuse AuthService
  exports: [AuthService],
})
export class AuthModule {}
