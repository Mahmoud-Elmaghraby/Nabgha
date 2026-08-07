import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { DatabaseModule } from '../../shared/infrastructure/database/database.module';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';
import { StudentsModule } from '../students/students.module';
import { FinanceModule } from '../finance/finance.module';
import { ParentJwtStrategy } from '../../shared/infrastructure/auth/jwt.strategy';
import { ParentPortalController } from './parent-portal.controller';
import { ParentPortalService } from './parent-portal.service';
import { ParentPortalRepository } from './parent-portal.repository';

@Module({
  imports: [
    DatabaseModule,
    WhatsAppModule,
    StudentsModule,
    FinanceModule,
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('PARENT_JWT_SECRET') as string,
        signOptions: { expiresIn: '30d' },
      }),
    }),
  ],
  controllers: [ParentPortalController],
  providers: [ParentPortalService, ParentPortalRepository, ParentJwtStrategy],
  exports: [ParentPortalService],
})
export class ParentPortalModule {}
