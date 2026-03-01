export type ExpenseType = "FIXED" | "OPTIONAL";
export type UserRole = "ADMIN" | "DEBTOR";

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
  accessEnabled: boolean;
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

export type GetMonthlyFreeAmountResponse = {
  year: number;
  currentSalary: string;
  monthlySavingsGoal: string;
  monthlyFixedExpenses: string;
  monthlyOptionalExpenses: string;
  monthlyFreeAmount: string;
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

export type SalaryPreviewResponse = {
  debtorId: string;
  year: number;
  month: number;
  totalUnpaidInstallments: string;
  salaryPreviewAmount: string;
  snapshot: SalarySnapshot | null;
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

export type LoginResponse = {
  accessToken: string;
  tokenType: string;
  expiresAt: string;
  userId: string;
  email: string;
  role: UserRole;
  debtorId: string | null;
  mustChangePassword: boolean;
};

export type DebtorAccessResponse = {
  debtorId: string;
  email: string;
  enabled: boolean;
  password: string | null;
  passwordGenerated: boolean;
};

export type MonthlySummaryInstallmentItem = {
  installmentId: string;
  debtDescription: string;
  installmentNumber: number;
  totalInstallments: number;
  dueDate: string;
  amount: string;
  paid: boolean;
  paidAt: string | null;
};

export type MonthlySummaryReportResponse = {
  debtorId: string;
  debtorName: string;
  debtorEmail: string;
  year: number;
  month: number;
  monthlyFreeAmount: string;
  halfFreeAmount: string;
  totalInstallmentsAmount: string;
  salaryColumnAmount: string;
  salaryStatus: "PAID" | "PENDING" | null;
  salaryPaidAt: string | null;
  installments: MonthlySummaryInstallmentItem[];
};
