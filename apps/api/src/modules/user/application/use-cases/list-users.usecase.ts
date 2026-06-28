import { Inject, Injectable } from '@nestjs/common';
import { IUserRepository, USER_REPOSITORY, ListUsersOptions, PaginatedUsers } from '../../domain/repositories/user.repository.interface';

@Injectable()
export class ListUsersUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
  ) {}

  async execute(options: ListUsersOptions, tenantId: string): Promise<PaginatedUsers> {
    return this.userRepository.list(options, tenantId);
  }
}
