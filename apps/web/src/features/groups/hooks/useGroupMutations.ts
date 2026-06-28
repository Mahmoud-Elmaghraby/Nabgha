import { useMutation, useQueryClient } from '@tanstack/react-query';
import { groupsApi } from '../api/groups.api';
import type { CreateGroupPayload, UpdateGroupPayload } from '../types/group.types';
import { GROUPS_KEY } from './useGroups';

export function useCreateGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateGroupPayload) => groupsApi.create(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [GROUPS_KEY] }),
  });
}

export function useUpdateGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateGroupPayload }) =>
      groupsApi.update(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [GROUPS_KEY] }),
  });
}

export function useDeleteGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => groupsApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [GROUPS_KEY] }),
  });
}

export function useAddStudentToGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, studentId }: { groupId: string; studentId: string }) =>
      groupsApi.addStudent(groupId, studentId),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: [GROUPS_KEY, vars.groupId, 'students'] });
      queryClient.invalidateQueries({ queryKey: [GROUPS_KEY] });
    },
  });
}

export function useRemoveStudentFromGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, studentId }: { groupId: string; studentId: string }) =>
      groupsApi.removeStudent(groupId, studentId),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: [GROUPS_KEY, vars.groupId, 'students'] });
      queryClient.invalidateQueries({ queryKey: [GROUPS_KEY] });
    },
  });
}
