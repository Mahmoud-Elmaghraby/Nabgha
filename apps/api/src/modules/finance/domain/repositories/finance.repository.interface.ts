import type {
  TreasuryEntity,
  MonthlyDueEntity,
  PaymentEntity,
  PaymentTransactionEntity,
  ExpenseEntity,
  TransactionType,
} from '../entities/finance.entity';
import type {
  CreateTreasuryDto,
  ListDuesDto,
  ListPaymentsDto,
  ListExpensesDto,
} from '../../application/dtos/finance.dto';

export interface IFinanceRepository {
  // ─── Treasuries ─────────────────────────────────────────
  findAllTreasuries(tenantId: string): Promise<TreasuryEntity[]>;
  findTreasuryById(tenantId: string, id: string): Promise<TreasuryEntity | null>;
  createTreasury(tenantId: string, data: CreateTreasuryDto): Promise<TreasuryEntity>;
  saveTreasury(tenantId: string, treasury: TreasuryEntity): Promise<void>;

  // ─── Monthly Dues ────────────────────────────────────────
  findDues(tenantId: string, params: ListDuesDto): Promise<{
    data: MonthlyDueEntity[]; total: number;
    totalDueAmount: number; totalDiscountApplied: number; totalPaidAmount: number;
  }>;
  findDueById(tenantId: string, id: string): Promise<MonthlyDueEntity | null>;
  findDueByStudentSubjectGradeMonth(
    tenantId: string, studentId: string, subjectGradeId: string, month: string,
  ): Promise<MonthlyDueEntity | null>;
  createDue(tenantId: string, data: {
    studentId: string; subjectGradeId: string; month: string;
    dueAmount: number; discountApplied: number; notes?: string; createdBy?: string;
  }): Promise<MonthlyDueEntity>;
  saveDue(tenantId: string, due: MonthlyDueEntity): Promise<void>;
  deleteDue(tenantId: string, id: string): Promise<void>;
  dueExists(tenantId: string, studentId: string, subjectGradeId: string, month: string): Promise<boolean>;
  getActiveEnrollments(tenantId: string): Promise<{
    studentId: string; subjectGradeId: string; fee: number; discount: number;
  }[]>;

  // ─── Payments ────────────────────────────────────────────
  findPayments(tenantId: string, params: ListPaymentsDto): Promise<{ data: PaymentEntity[]; total: number }>;
  findPaymentById(tenantId: string, id: string): Promise<PaymentEntity | null>;
  findPaymentsByStudent(tenantId: string, studentId: string): Promise<PaymentEntity[]>;
  createPayment(tenantId: string, data: {
    studentId: string; monthlyDueId: string; treasuryId: string;
    amount: number; paymentMethod: string; notes?: string; createdBy?: string;
  }): Promise<PaymentEntity>;
  savePayment(tenantId: string, payment: PaymentEntity): Promise<void>;

  // ─── Transactions ─────────────────────────────────────────
  createTransaction(tenantId: string, data: {
    paymentId?: string; treasuryId: string; type: TransactionType;
    amount: number; balanceBefore: number; balanceAfter: number;
    notes?: string; createdBy?: string; relatedTreasuryId?: string;
  }): Promise<void>;
  findTransactionsByTreasury(tenantId: string, treasuryId: string): Promise<PaymentTransactionEntity[]>;

  // ─── Treasury Summary ──────────────────────────────────────
  getTreasurySummary(tenantId: string, treasuryId: string): Promise<{
    totalIncome: number; totalExpenses: number; totalTransfersIn: number; totalTransfersOut: number;
  }>;

  // ─── Expenses ─────────────────────────────────────────────
  findExpenses(tenantId: string, params: ListExpensesDto): Promise<{ data: ExpenseEntity[]; total: number }>;
  findExpenseById(tenantId: string, id: string): Promise<ExpenseEntity | null>;
  createExpense(tenantId: string, data: {
    treasuryId: string; category: string; title: string;
    amount: number; expenseDate: Date; notes?: string; createdBy?: string;
  }): Promise<ExpenseEntity>;
  saveExpense(tenantId: string, expense: ExpenseEntity): Promise<void>;

  // ─── Stats ────────────────────────────────────────────────
  getStats(tenantId: string, month: string): Promise<{
    totalDues: number; totalCollected: number; totalPending: number;
    totalExpenses: number; duesCount: number; paidCount: number; unpaidCount: number;
  }>;

  // ─── Collection ───────────────────────────────────────────
  searchStudentsForCollection(tenantId: string, query: string): Promise<{
    studentId: string; studentName: string; studentCode: string;
  }[]>;
  findOpenDuesByStudentId(tenantId: string, studentId: string): Promise<{
    studentId: string; studentName: string; studentCode: string;
    dues: any[];
  } | null>;

  // ─── Student Profile ──────────────────────────────────────
  getStudentFinancialProfile(tenantId: string, studentId: string): Promise<{
    dues: MonthlyDueEntity[];
    payments: PaymentEntity[];
    totalDues: number;
    totalPaid: number;
    totalPending: number;
  }>;
}

export const FINANCE_REPOSITORY = 'IFinanceRepository';
