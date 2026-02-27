export type ExpenseType = "FIXED" | "OPTIONAL";

export type ApiErrorResponse = {
  timestamp: string;
  status: number;
  error: string;
  message: string;
};

export type Debtor = {
  id: string;
  name: string;
  email: string;
  totalDebt: string;
};

export type ListDebtorsResponse = {
  debtors: Debtor[];
};

export type CreateDebtorResponse = {
  debtorId: string;
};

export type CreateSalaryResponse = {
  id: string;
  amount: string;
  createdAt: string;
};

export type CreateSavingsGoalResponse = {
  id: string;
  amount: string;
  createdAt: string;
};

export type MonthlyFreeAmountItem = {
  month: number;
  year: number;
  freeAmount: string;
};

export type GetMonthlyFreeAmountResponse = {
  year: number;
  currentSalary: string;
  monthlySavingsGoal: string;
  monthlyFixedExpenses: string;
  monthlyOptionalExpenses: string;
  monthlyFreeAmount: string;
  months: MonthlyFreeAmountItem[];
};

export type SalarySnapshotStatus = "PENDING" | "PAID";

export type SalarySnapshot = {
  id: string;
  debtorId: string;
  year: number;
  month: number;
  monthlyFreeAmount: string;
  halfFreeAmount: string;
  totalInstallmentsAmount: string;
  salaryColumnAmount: string;
  status: SalarySnapshotStatus;
  createdAt: string;
  paidAt: string | null;
};

export type PayMonthlySalaryResponse = {
  created: boolean;
  snapshot: SalarySnapshot;
};

export type RecurringExpense = {
  id: string;
  description: string;
  amount: string;
};

export type ListRecurringExpensesResponse = {
  recurringExpenses: RecurringExpense[];
};

export type RecurringExpensesTotalResponse = {
  total: string;
};

export type CreateRecurringExpenseResponse = {
  recurringExpenseId: string;
};

export type UpdateRecurringExpenseResponse = {
  id: string;
  description: string;
  amount: string;
};

export type CreateDebtResponse = {
  debtId: string;
};

export type Installment = {
  id: string;
  number: number;
  dueDate: string;
  paidAt: string | null;
  amount: string;
};

export type UnpaidInstallmentByMonthItem = {
  installmentId: string;
  debtId: string;
  debtDescription: string;
  installmentNumber: number;
  totalInstallments: number;
  dueDate: string;
  amount: string;
  paid: boolean;
  paidAt: string | null;
};

export type GetUnpaidInstallmentsByMonthResponse = {
  debtorId: string;
  debtorName: string;
  debtorEmail: string;
  year: number;
  month: number;
  totalAmount: string;
  installments: UnpaidInstallmentByMonthItem[];
};

export type Debt = {
  id: string;
  description: string;
  totalAmount: string;
  createdAt: string;
  settled: boolean;
  installments: Installment[];
};

export type GetDebtDetailResponse = {
  id: string;
  name: string;
  email: string;
  debt: Debt;
};
