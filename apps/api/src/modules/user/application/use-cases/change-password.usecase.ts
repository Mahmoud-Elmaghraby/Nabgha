import { Inject, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { IUserRepository, USER_REPOSITORY } from '../../domain/repositories/user.repository.interface';
import { ChangePasswordDto } from '../dtos/update-user.dto';
import { UserNotFoundException, InvalidPasswordException } from '../../domain/exceptions/user.exceptions';
import { KyselyService } from '../../../../shared/infrastructure/database/kysely.service';

@Injectable()
export class ChangePasswordUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    private readonly kyselyService: KyselyService,
  ) {}

  async execute(id: string, dto: ChangePasswordDto, tenantId: string): Promise<void> {
    const user = await this.userRepository.findById(id, tenantId);
    if (!user) {
      throw new UserNotFoundException();
    }

    const db = await this.kyselyService.getTenantDb(tenantId);
    const row = await db
      .selectFrom('users')
      .select('password_hash')
      .where('id', '=', id as any)
      .executeTakeFirst();

    if (!row) {
      throw new UserNotFoundException();
    }

    const isValid = await bcrypt.compare(dto.currentPassword, row.password_hash);
    if (!isValid) {
      throw new InvalidPasswordException();
    }

    const newPasswordHash = await bcrypt.hash(dto.newPassword, 12);
    await this.userRepository.updatePassword(id, newPasswordHash, tenantId);
  }
}
