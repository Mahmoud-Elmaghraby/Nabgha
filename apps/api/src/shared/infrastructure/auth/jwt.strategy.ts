import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

export interface JwtPayload {
  sub: string;
  tenantId: string;
  role: string;
  permissions: string[];
  type: 'tenant' | 'platform';
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET') as string,
    });
  }

  async validate(payload: JwtPayload) {
    // ملاحظة أمان: كان بيتحقق بس من وجود sub/tenantId من غير ما يتأكد إن
    // type فعلاً 'tenant' — يعني أي توكن تاني موقّع بنفس JWT_SECRET وفيه
    // sub/tenantId كان ممكن يعدي هنا. ضفنا التحقق من type صراحة كطبقة حماية إضافية.
    // tokenUse = 'refresh' → ده refresh token، مش مسموح يتستخدم للدخول على الـ API
    if (!payload.sub || !payload.tenantId || payload.type !== 'tenant' || (payload as any).tokenUse === 'refresh') {
      throw new UnauthorizedException();
    }
    return payload;
  }
}

@Injectable()
export class PlatformJwtStrategy extends PassportStrategy(Strategy, 'platform-jwt') {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('PLATFORM_JWT_SECRET') as string,
    });
  }

  async validate(payload: JwtPayload) {
    if (!payload.sub || payload.type !== 'platform' || (payload as any).tokenUse === 'refresh') {
      throw new UnauthorizedException();
    }
    return payload;
  }
}

// ===== بوابة أولياء الأمور =====
// عمدًا سرّ (secret) واستراتيجية Passport منفصلين تمامًا عن باقي التوكنات
// (الموظفين/الـ platform)، مش مجرد "type" مختلف بنفس السر — عشان لو حصل أي
// خطأ برمجي وحد نسي يتحقق من type في مكان ما (زي JwtStrategy.validate() اللي
// فوق أصلاً مش بتتحقق من type!)، توكن ولي الأمر يفضل مرفوض تلقائيًا في أي
// مسار خاص بالموظفين لأن السر نفسه مختلف، مش بس المنطق.
export interface ParentJwtPayload {
  sub: string; // رقم الهاتف بعد التوحيد (normalizePhone)
  tenantId: string;
  studentIds: string[];
  type: 'parent';
}

@Injectable()
export class ParentJwtStrategy extends PassportStrategy(Strategy, 'parent-jwt') {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: (config.get<string>('PARENT_JWT_SECRET') as string) || 'unset-parent-jwt-secret',
    });
  }

  async validate(payload: ParentJwtPayload) {
    if (!payload.sub || !payload.tenantId || payload.type !== 'parent') {
      throw new UnauthorizedException();
    }
    return payload;
  }
}
