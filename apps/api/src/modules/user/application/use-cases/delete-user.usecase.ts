import { Inject, Injectable } from '@nestjs/common';
import { IUserRepository, USER_REPOSITORY } from '../../domain/repositories/user.repository.interface';
import { UserNotFoundException, CannotDeleteSelfException } from '../../domain/exceptions/user.exceptions';

@Injectable()
export class DeleteUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
  ) {}

  async execute(id: string, tenantId: string, requesterId: string): Promise<void> {
    const user = await this.userRepository.findById(id, tenantId);
    if (!user) {
      throw new UserNotFoundException();
    }

    if (!user.canBeDeletedBy(requesterId)) {
      throw new CannotDeleteSelfException();
    }

    await this.userRepository.delete(id, tenantId);
  }
}
