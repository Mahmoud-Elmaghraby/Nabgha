import { apiClient } from '../../../shared/lib/api/client';
import type { Treasury, MonthlyDue, Payment, Expense, FinanceStats, ListDuesParams, ListPaymentsParams, ListExpensesParams, CreateManualDuePayload, TreasuryDetail, TransferBetweenTreasuriesPayload } from '../types/finance.types';

export interface StudentFinancialProfile {
  studentId: string;
  studentName: string;
  studentCode: string;
  dues: MonthlyDue[];
}

export const financeApi = {
  getTreasuries: async (): Promise<Treasury[]> => {
    const res = await apiClient.get('/finance/treasuries');
    return res.data.data;
  },
  getTreasury: async (id: string): Promise<Treasury> => {
    const res = await apiClient.get(`/finance/treasuries/${id}`);
    return res.data.data;
  },
  createTreasury: async (data: { name: string; type: string; notes?: string }): Promise<Treasury> => {
    const res = await apiClient.post('/finance/treasuries', data);
    return res.data.data;
  },
  updateTreasury: async (id: string, data: any): Promise<Treasury> => {
    const res = await apiClient.put(`/finance/treasuries/${id}`, data);
    return res.data.data;
  },
  deleteTreasury: async (id: string): Promise<void> => {
    await apiClient.delete(`/finance/treasuries/${id}`);
  },
  getTreasuryDetail: async (id: string): Promise<TreasuryDetail> => {
    const res = await apiClient.get(`/finance/treasuries/${id}/detail`);
    return res.data.data;
  },
  transferBetweenTreasuries: async (data: TransferBetweenTreasuriesPayload): Promise<void> => {
    await apiClient.post('/finance/treasuries/transfer', data);
  },
  getDues: async (params: ListDuesParams): Promise<{
    data: MonthlyDue[]; total: number;
    totalDueAmount: number; totalDiscountApplied: number; totalPaidAmount: number;
  }> => {
    const res = await apiClient.get('/finance/dues', { params });
    return {
      data: res.data.data, total: res.data.total,
      totalDueAmount: res.data.totalDueAmount,
      totalDiscountApplied: res.data.totalDiscountApplied,
      totalPaidAmount: res.data.totalPaidAmount,
    };
  },
  getDue: async (id: string): Promise<MonthlyDue> => {
    const res = await apiClient.get(`/finance/dues/${id}`);
    return res.data.data;
  },
  generateDues: async (month: string): Promise<{ created: number; skipped: number }> => {
    const res = await apiClient.post('/finance/dues/generate', { month });
    return res.data.data;
  },
  updateDue: async (id: string, data: any): Promise<MonthlyDue> => {
    const res = await apiClient.put(`/finance/dues/${id}`, data);
    return res.data.data;
  },
  createManualDue: async (data: CreateManualDuePayload): Promise<MonthlyDue> => {
    const res = await apiClient.post('/finance/dues/manual', data);
    return res.data.data;
  },
  waiveDue: async (id: string, notes?: string): Promise<MonthlyDue> => {
    const res = await apiClient.patch(`/finance/dues/${id}/waive`, { notes });
    return res.data.data;
  },
  deleteDue: async (id: string): Promise<void> => {
    await apiClient.delete(`/finance/dues/${id}`);
  },
  getPayments: async (params: ListPaymentsParams): Promise<{ data: Payment[]; total: number }> => {
    const res = await apiClient.get('/finance/payments', { params });
    return { data: res.data.data, total: res.data.total };
  },
  getPayment: async (id: string): Promise<Payment> => {
    const res = await apiClient.get(`/finance/payments/${id}`);
    return res.data.data;
  },
  createPayment: async (data: { monthlyDueId: string; treasuryId: string; amount: number; paymentMethod: string; notes?: string }): Promise<Payment> => {
    const res = await apiClient.post('/finance/payments', data);
    return res.data.data;
  },
  cancelPayment: async (id: string, reason: string): Promise<Payment> => {
    const res = await apiClient.post(`/finance/payments/${id}/cancel`, { reason });
    return res.data.data;
  },
  refundPayment: async (id: string, amount: number, notes?: string): Promise<Payment> => {
    const res = await apiClient.post(`/finance/payments/${id}/refund`, { amount, notes });
    return res.data.data;
  },
  getExpenses: async (params: ListExpensesParams): Promise<{ data: Expense[]; total: number }> => {
    const res = await apiClient.get('/finance/expenses', { params });
    return { data: res.data.data, total: res.data.total };
  },
  createExpense: async (data: { treasuryId: string; category: string; title: string; amount: number; expenseDate?: string; notes?: string }): Promise<Expense> => {
    const res = await apiClient.post('/finance/expenses', data);
    return res.data.data;
  },
  updateExpense: async (id: string, data: any): Promise<Expense> => {
    const res = await apiClient.put(`/finance/expenses/${id}`, data);
    return res.data.data;
  },
  deleteExpense: async (id: string): Promise<void> => {
    await apiClient.delete(`/finance/expenses/${id}`);
  },
  getStats: async (month: string): Promise<FinanceStats> => {
    const res = await apiClient.get('/finance/stats', { params: { month } });
    return res.data.data;
  },
  getStudentFinancialProfile: async (studentId: string): Promise<StudentFinancialProfile> => {
    const res = await apiClient.get(`/finance/collect/student/${studentId}/profile`);
    return res.data.data;
  },
  getStudentPayments: async (studentId: string): Promise<{ data: Payment[]; total: number }> => {
    const res = await apiClient.get('/finance/payments', { params: { studentId, limit: 50 } });
    return { data: res.data.data, total: res.data.total };
  },
};
