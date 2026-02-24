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

export type Debt = {
  id: string;
  description: string;
  totalAmount: string;
  createdAt: string;
  settled: boolean;
  installments: Installment[];
};

export type GetDebtsResponse = {
  id: string;
  name: string;
  email: string;
  debts: Debt[];
};
