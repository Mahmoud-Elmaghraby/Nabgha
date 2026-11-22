import { Module } from '@nestjs/common';
import { UserController } from './presentation/user.controller';
import { CreateUserUseCase } from './application/use-cases/create-user.usecase';
import { ListUsersUseCase } from './application/use-cases/list-users.usecase';
import { GetUserUseCase } from './application/use-cases/get-user.usecase';
import { UpdateUserUseCase } from './application/use-cases/update-user.usecase';
import { DeleteUserUseCase } from './application/use-cases/delete-user.usecase';
import { ChangePasswordUseCase } from './application/use-cases/change-password.usecase';
import { UserKyselyRepository } from './infrastructure/user.kysely.repository';
import { USER_REPOSITORY } from './domain/repositories/user.repository.interface';

@Module({
  controllers: [UserController],
  providers: [
    CreateUserUseCase,
    ListUsersUseCase,
    GetUserUseCase,
    UpdateUserUseCase,
    DeleteUserUseCase,
    ChangePasswordUseCase,
    {
      provide: USER_REPOSITORY,
      useClass: UserKyselyRepository,
    },
  ],
  exports: [CreateUserUseCase, GetUserUseCase],
})
export class UserModule {}
