import { useQuery } from '@tanstack/react-query';
import { usersApi } from '../api/users.api';
import type { ListUsersParams } from '../types/user.types';

export const USERS_KEY = 'users';

export function useUsers(params?: ListUsersParams) {
  return useQuery({
    queryKey: [USERS_KEY, params],
    queryFn: () => usersApi.list(params),
  });
}

export function useUser(id: string) {
  return useQuery({
    queryKey: [USERS_KEY, id],
    queryFn: () => usersApi.getOne(id),
    enabled: !!id,
  });
}
