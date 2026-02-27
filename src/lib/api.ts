import type {
  ApiErrorResponse,
  CreateDebtResponse,
  CreateDebtorResponse,
  GetDebtDetailResponse,
  CreateRecurringExpenseResponse,
  CreateSavingsGoalResponse,
  CreateSalaryResponse,
  ExpenseType,
  GetMonthlyFreeAmountResponse,
  SalarySnapshot,
  PayMonthlySalaryResponse,
  GetUnpaidInstallmentsByMonthResponse,
  ListDebtorsResponse,
  ListRecurringExpensesResponse,
  RecurringExpensesTotalResponse,
  UpdateRecurringExpenseResponse
} from "../types";

type RequestOptions = RequestInit & {
  bodyJson?: unknown;
};

class ApiClientError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { bodyJson, headers, ...rest } = options;

  const response = await fetch(path, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...headers
    },
    body: bodyJson !== undefined ? JSON.stringify(bodyJson) : rest.body
  });

  if (!response.ok) {
    let message = `HTTP ${response.status}`;

    try {
      const apiError = (await response.json()) as Partial<ApiErrorResponse>;
      if (typeof apiError.message === "string" && apiError.message.trim().length > 0) {
        message = apiError.message;
      }
    } catch {
      // Use fallback message when backend returns no JSON body.
    }

    throw new ApiClientError(message, response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

async function requestBlob(path: string, options: RequestOptions = {}): Promise<Blob> {
  const { bodyJson, headers, ...rest } = options;
  const response = await fetch(path, {
    ...rest,
    headers: {
      ...headers
    },
    body: bodyJson !== undefined ? JSON.stringify(bodyJson) : rest.body
  });

  if (!response.ok) {
    throw new ApiClientError(`HTTP ${response.status}`, response.status);
  }

  return response.blob();
}

export { ApiClientError };

export const api = {
  listDebtors() {
    return request<ListDebtorsResponse>("/api/debtors");
  },
  createDebtor(payload: { name: string; email: string }) {
    return request<CreateDebtorResponse>("/api/debtors", {
      method: "POST",
      bodyJson: payload
    });
  },
  createSalary(payload: { amount: number }) {
    return request<CreateSalaryResponse>("/api/salaries", {
      method: "POST",
      bodyJson: payload
    });
  },
  createSavingsGoal(payload: { amount: number }) {
    return request<CreateSavingsGoalResponse>("/api/savings-goals", {
      method: "POST",
      bodyJson: payload
    });
  },
  getMonthlyFreeAmount(year: number) {
    const params = new URLSearchParams({ year: String(year) });
    return request<GetMonthlyFreeAmountResponse>(`/api/financial-plan/monthly-free-amount?${params.toString()}`);
  },
  getSalarySnapshot(payload: { debtorId: string; year: number; month: number }) {
    const params = new URLSearchParams({
      debtorId: payload.debtorId,
      year: String(payload.year),
      month: String(payload.month)
    });
    return request<SalarySnapshot>(`/api/salary-snapshots?${params.toString()}`);
  },
  payMonthlySalary(payload: { debtorId: string; year: number; month: number; paymentDate: string }) {
    return request<PayMonthlySalaryResponse>("/api/salary-snapshots/pay", {
      method: "POST",
      bodyJson: payload
    });
  },
  downloadMonthlySummaryPdf(payload: { debtorId: string; year: number; month: number }) {
    const params = new URLSearchParams({
      debtorId: payload.debtorId,
      year: String(payload.year),
      month: String(payload.month)
    });
    return requestBlob(`/api/reports/monthly-summary.pdf?${params.toString()}`);
  },
  createRecurringExpense(payload: { description: string; amount: number; type: ExpenseType }) {
    return request<CreateRecurringExpenseResponse>("/api/recurring-expenses", {
      method: "POST",
      bodyJson: payload
    });
  },
  listRecurringExpenses(type: ExpenseType) {
    const params = new URLSearchParams({ type });
    return request<ListRecurringExpensesResponse>(`/api/recurring-expenses?${params.toString()}`);
  },
  getRecurringExpenseTotal(type: ExpenseType) {
    const params = new URLSearchParams({ type });
    return request<RecurringExpensesTotalResponse>(`/api/recurring-expenses/total?${params.toString()}`);
  },
  updateRecurringExpense(id: string, payload: { description: string; amount: number }) {
    return request<UpdateRecurringExpenseResponse>(`/api/recurring-expenses/${id}`, {
      method: "PATCH",
      bodyJson: payload
    });
  },
  deleteRecurringExpense(id: string) {
    return request<void>(`/api/recurring-expenses/${id}`, {
      method: "DELETE"
    });
  },
  createDebt(payload: {
    debt: { debtorId: string; description: string; totalAmount: number };
    installments: {
      installmentsCount: number;
      installmentAmount: number;
      firstInstallmentDueDate: string;
    };
  }) {
    return request<CreateDebtResponse>("/api/debts", {
      method: "POST",
      bodyJson: payload
    });
  },
  deleteDebt(debtId: string) {
    return request<void>(`/api/debts/${debtId}`, {
      method: "DELETE"
    });
  },
  getDebtDetail(debtId: string) {
    return request<GetDebtDetailResponse>(`/api/debts/${debtId}`);
  },
  payInstallment(installmentId: string, payload: { paymentDate: string }) {
    return request<void>(`/api/installments/${installmentId}/pay`, {
      method: "PATCH",
      bodyJson: payload
    });
  },
  getUnpaidInstallmentsByMonth(payload: { debtorId: string; year: number; month: number }) {
    const params = new URLSearchParams({
      debtorId: payload.debtorId,
      year: String(payload.year),
      month: String(payload.month)
    });
    return request<GetUnpaidInstallmentsByMonthResponse>(`/api/installments/unpaid?${params.toString()}`);
  }
};
