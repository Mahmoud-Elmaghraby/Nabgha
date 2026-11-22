import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy, PlatformJwtStrategy } from '../../shared/infrastructure/auth/jwt.strategy';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        // مدة الصلاحية الفعلية بتتحدد في AuthService (JWT_ACCESS_EXPIRY / JWT_REFRESH_EXPIRY)
        secret: config.get<string>('JWT_SECRET') as string,
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, PlatformJwtStrategy],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
