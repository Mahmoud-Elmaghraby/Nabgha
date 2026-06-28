import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { financeApi } from '../api/finance.api';
import type { ListDuesParams, ListPaymentsParams, ListExpensesParams } from '../types/finance.types';

const KEYS = {
  treasuries: ['finance', 'treasuries'] as const,
  dues: (p: ListDuesParams) => ['finance', 'dues', p] as const,
  payments: (p: ListPaymentsParams) => ['finance', 'payments', p] as const,
  expenses: (p: ListExpensesParams) => ['finance', 'expenses', p] as const,
  stats: (month: string) => ['finance', 'stats', month] as const,
};

export function useTreasuries() {
  return useQuery({ queryKey: KEYS.treasuries, queryFn: financeApi.getTreasuries });
}

export function useTreasuryMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['finance', 'treasuries'] });
  const create = useMutation({ mutationFn: financeApi.createTreasury, onSuccess: invalidate });
  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => financeApi.updateTreasury(id, data),
    onSuccess: invalidate,
  });
  const remove = useMutation({ mutationFn: financeApi.deleteTreasury, onSuccess: invalidate });
  return { create, update, remove };
}

export function useDues(params: ListDuesParams) {
  return useQuery({ queryKey: KEYS.dues(params), queryFn: () => financeApi.getDues(params) });
}

export function useDueMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['finance', 'dues'] });
  const generate = useMutation({ mutationFn: financeApi.generateDues, onSuccess: invalidate });
  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => financeApi.updateDue(id, data),
    onSuccess: invalidate,
  });
  const waive = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) => financeApi.waiveDue(id, notes),
    onSuccess: invalidate,
  });
  return { generate, update, waive };
}

export function usePayments(params: ListPaymentsParams) {
  return useQuery({ queryKey: KEYS.payments(params), queryFn: () => financeApi.getPayments(params) });
}

export function usePaymentMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['finance', 'payments'] });
    qc.invalidateQueries({ queryKey: ['finance', 'dues'] });
    qc.invalidateQueries({ queryKey: ['finance', 'treasuries'] });
    qc.invalidateQueries({ queryKey: ['finance', 'stats'] });
  };
  const create = useMutation({ mutationFn: financeApi.createPayment, onSuccess: invalidate });
  const cancel = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => financeApi.cancelPayment(id, reason),
    onSuccess: invalidate,
  });
  const refund = useMutation({
    mutationFn: ({ id, amount, notes }: { id: string; amount: number; notes?: string }) => financeApi.refundPayment(id, amount, notes),
    onSuccess: invalidate,
  });
  return { create, cancel, refund };
}

export function useExpenses(params: ListExpensesParams) {
  return useQuery({ queryKey: KEYS.expenses(params), queryFn: () => financeApi.getExpenses(params) });
}

export function useExpenseMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['finance', 'expenses'] });
    qc.invalidateQueries({ queryKey: ['finance', 'treasuries'] });
    qc.invalidateQueries({ queryKey: ['finance', 'stats'] });
  };
  const create = useMutation({ mutationFn: financeApi.createExpense, onSuccess: invalidate });
  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => financeApi.updateExpense(id, data),
    onSuccess: invalidate,
  });
  const remove = useMutation({ mutationFn: financeApi.deleteExpense, onSuccess: invalidate });
  return { create, update, remove };
}

export function useFinanceStats(month: string) {
  return useQuery({
    queryKey: KEYS.stats(month),
    queryFn: () => financeApi.getStats(month),
    enabled: !!month,
  });
}

export function useStudentFinancialProfile(studentId: string) {
  return useQuery({
    queryKey: ['finance', 'student-profile', studentId],
    queryFn: () => financeApi.getStudentFinancialProfile(studentId),
    enabled: !!studentId,
  });
}

export function useStudentPayments(studentId: string) {
  return useQuery({
    queryKey: ['finance', 'student-payments', studentId],
    queryFn: () => financeApi.getStudentPayments(studentId),
    enabled: !!studentId,
  });
}
