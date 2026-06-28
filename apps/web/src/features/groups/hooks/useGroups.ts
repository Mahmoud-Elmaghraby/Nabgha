import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { groupsApi } from '../api/groups.api';
import type {
  CreateGroupPayload,
  UpdateGroupPayload,
  AddStudentPayload,
  ListGroupsParams,
} from '../types/group.types';

export const GROUP_KEYS = {
  all: ['groups'] as const,
  list: (params?: ListGroupsParams) => ['groups', 'list', params] as const,
  detail: (id: string) => ['groups', id] as const,
  students: (groupId: string) => ['groups', groupId, 'students'] as const,
};

export function useGroups(params?: ListGroupsParams) {
  return useQuery({
    queryKey: GROUP_KEYS.list(params),
    queryFn: () => groupsApi.list(params),
  });
}

export function useGroup(id: string) {
  return useQuery({
    queryKey: GROUP_KEYS.detail(id),
    queryFn: () => groupsApi.getOne(id),
    enabled: !!id,
  });
}

export function useGroupStudents(groupId: string) {
  return useQuery({
    queryKey: GROUP_KEYS.students(groupId),
    queryFn: () => groupsApi.getStudents(groupId),
    enabled: !!groupId,
  });
}

export function useGroupMutations() {
  const qc = useQueryClient();

  const invalidateAll = () => qc.invalidateQueries({ queryKey: GROUP_KEYS.all });

  const createGroup = useMutation({
    mutationFn: (data: CreateGroupPayload) => groupsApi.create(data),
    onSuccess: invalidateAll,
  });

  const updateGroup = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateGroupPayload }) =>
      groupsApi.update(id, data),
    onSuccess: invalidateAll,
  });

  const deleteGroup = useMutation({
    mutationFn: (id: string) => groupsApi.delete(id),
    onSuccess: invalidateAll,
  });

  const addStudent = useMutation({
    mutationFn: ({ groupId, payload }: { groupId: string; payload: AddStudentPayload }) =>
      groupsApi.addStudent(groupId, payload),
    onSuccess: (_, { groupId }) => {
      qc.invalidateQueries({ queryKey: GROUP_KEYS.students(groupId) });
      qc.invalidateQueries({ queryKey: GROUP_KEYS.all });
      qc.invalidateQueries({ queryKey: ['students'] });
    },
  });

  const updateDiscount = useMutation({
    mutationFn: ({ groupId, studentId, discount }: { groupId: string; studentId: string; discount: number }) =>
      groupsApi.updateStudentDiscount(groupId, studentId, discount),
    onSuccess: (_, { groupId }) =>
      qc.invalidateQueries({ queryKey: GROUP_KEYS.students(groupId) }),
  });

  const removeStudent = useMutation({
    mutationFn: ({ groupId, studentId }: { groupId: string; studentId: string }) =>
      groupsApi.removeStudent(groupId, studentId),
    onSuccess: (_, { groupId }) => {
      qc.invalidateQueries({ queryKey: GROUP_KEYS.students(groupId) });
      qc.invalidateQueries({ queryKey: GROUP_KEYS.all });
      qc.invalidateQueries({ queryKey: ['students'] });
    },
  });

  return { createGroup, updateGroup, deleteGroup, addStudent, updateDiscount, removeStudent };
}
