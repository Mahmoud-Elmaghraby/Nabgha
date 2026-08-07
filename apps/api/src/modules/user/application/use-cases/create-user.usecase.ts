import { Inject, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { IUserRepository, USER_REPOSITORY } from '../../domain/repositories/user.repository.interface';
import { CreateUserDto } from '../dtos/create-user.dto';
import { UserEntity } from '../../domain/entities/user.entity';
import { UsernameAlreadyExistsException } from '../../domain/exceptions/user.exceptions';

@Injectable()
export class CreateUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
  ) {}

  async execute(dto: CreateUserDto, tenantId: string): Promise<UserEntity> {
    const existing = await this.userRepository.findByUsername(dto.username, tenantId);
    if (existing) {
      throw new UsernameAlreadyExistsException();
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    return this.userRepository.create(
      {
        name: dto.name,
        email: dto.email ?? null,
        username: dto.username,
        passwordHash,
        role: dto.role,
        permissions: dto.permissions,
      },
      tenantId,
    );
  }
}
