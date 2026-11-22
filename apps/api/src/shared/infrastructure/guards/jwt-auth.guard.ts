import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}

@Injectable()
export class PlatformJwtAuthGuard extends AuthGuard('platform-jwt') {}

@Injectable()
export class ParentJwtAuthGuard extends AuthGuard('parent-jwt') {}
