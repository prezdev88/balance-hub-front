import { startTransition, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { ApiClientError, api } from "./lib/api";
import type {
  GetMonthlyFreeAmountResponse,
  Debt,
  Debtor,
  ExpenseType,
  GetDebtDetailResponse,
  GetUnpaidInstallmentsByMonthResponse,
  RecurringExpense,
  SalarySnapshot
} from "./types";

type TabKey = "debtors" | "debtorProfile" | "debts" | "recurring" | "salary";

type AppNotice = {
  type: "success" | "error";
  text: string;
} | null;

type PendingRecurringDelete = {
  id: string;
  description: string;
  type: ExpenseType;
} | null;

type PendingDebtDelete = {
  debtId: string;
  debtDescription: string;
} | null;

type DebtDetailModalState = {
  debtorId: string;
  debtorName: string;
  debtorEmail: string;
  debtId: string;
} | null;

type DebtCreationDebtorContext = {
  id: string;
  name: string;
  email: string;
} | null;

type RecurringState = {
  FIXED: RecurringExpense[];
  OPTIONAL: RecurringExpense[];
};

type RecurringTotals = {
  FIXED: string;
  OPTIONAL: string;
};

const TAB_OPTIONS: Array<{ key: TabKey; label: string }> = [
  { key: "debtors", label: "Deudores" },
  { key: "debtorProfile", label: "Perfil deudor" },
  { key: "recurring", label: "Gastos recurrentes" },
  { key: "salary", label: "Sueldos" }
];

const EMPTY_RECURRING: RecurringState = { FIXED: [], OPTIONAL: [] };
const EMPTY_TOTALS: RecurringTotals = { FIXED: "0", OPTIONAL: "0" };
const MONTH_OPTIONS = [
  { value: 1, label: "Enero" },
  { value: 2, label: "Febrero" },
  { value: 3, label: "Marzo" },
  { value: 4, label: "Abril" },
  { value: 5, label: "Mayo" },
  { value: 6, label: "Junio" },
  { value: 7, label: "Julio" },
  { value: 8, label: "Agosto" },
  { value: 9, label: "Septiembre" },
  { value: 10, label: "Octubre" },
  { value: 11, label: "Noviembre" },
  { value: 12, label: "Diciembre" }
];
const DEBT_DETAIL_PAGE_SIZE = 5;

function getTodayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function getCurrentYear(): number {
  return new Date().getFullYear();
}

function getCurrentMonth(): number {
  return new Date().getMonth() + 1;
}

function formatCurrency(value: string | number): string {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return String(value);
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0
  }).format(numeric);
}

function formatAmountInput(value: string): string {
  const digitsOnly = value.replace(/\D/g, "");
  if (!digitsOnly) return "";
  return new Intl.NumberFormat("es-CL", {
    maximumFractionDigits: 0
  }).format(Number(digitsOnly));
}

function parseAmountInput(value: string): number {
  const digitsOnly = value.replace(/\D/g, "");
  return digitsOnly ? Number(digitsOnly) : 0;
}

const MONTH_ABBREVIATIONS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function formatDate(value: string | null): string {
  if (!value) return "-";

  const dateOnlyMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnlyMatch) {
    const year = Number(dateOnlyMatch[1]);
    const month = Number(dateOnlyMatch[2]);
    const day = Number(dateOnlyMatch[3]);
    if (month >= 1 && month <= 12) {
      return `${String(day).padStart(2, "0")}-${MONTH_ABBREVIATIONS[month - 1]}-${year}`;
    }
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const day = String(date.getDate()).padStart(2, "0");
  const month = MONTH_ABBREVIATIONS[date.getMonth()];
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}

function getExpenseTypeLabel(type: ExpenseType): string {
  return type === "FIXED" ? "Fijo" : "Opcional";
}

function getExpenseTypeClassName(type: ExpenseType): string {
  return type === "FIXED" ? "expense-fixed" : "expense-optional";
}

function getMonthLabel(month: number): string {
  return MONTH_OPTIONS.find((item) => item.value === month)?.label.toLowerCase() ?? String(month);
}

function Section({
  title,
  description,
  children
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="panel">
      <div className="panel-header">
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

function App() {
  const [activeTab, setActiveTab] = useState<TabKey>("debtors");
  const [bootLoading, setBootLoading] = useState(true);
  const [notice, setNotice] = useState<AppNotice>(null);

  const [debtors, setDebtors] = useState<Debtor[]>([]);
  const [recurringExpenses, setRecurringExpenses] = useState<RecurringState>(EMPTY_RECURRING);
  const [recurringTotals, setRecurringTotals] = useState<RecurringTotals>(EMPTY_TOTALS);
  const [pendingRecurringDelete, setPendingRecurringDelete] = useState<PendingRecurringDelete>(null);
  const [pendingDebtDelete, setPendingDebtDelete] = useState<PendingDebtDelete>(null);
  const [unpaidByMonthLoading, setUnpaidByMonthLoading] = useState(false);
  const [unpaidByMonthResult, setUnpaidByMonthResult] = useState<GetUnpaidInstallmentsByMonthResponse | null>(null);
  const [debtDetailModal, setDebtDetailModal] = useState<DebtDetailModalState>(null);
  const [debtDetailLoading, setDebtDetailLoading] = useState(false);
  const [debtDetail, setDebtDetail] = useState<Debt | null>(null);
  const [debtDetailPage, setDebtDetailPage] = useState(1);
  const [debtCreationDebtorContext, setDebtCreationDebtorContext] = useState<DebtCreationDebtorContext>(null);

  const [debtorForm, setDebtorForm] = useState({ name: "", email: "" });
  const [salaryAmount, setSalaryAmount] = useState("");
  const [savingsGoalAmount, setSavingsGoalAmount] = useState("");
  const [salaryLastCreated, setSalaryLastCreated] = useState<{
    id: string;
    amount: string;
    createdAt: string;
  } | null>(null);
  const [savingsGoalLastCreated, setSavingsGoalLastCreated] = useState<{
    id: string;
    amount: string;
    createdAt: string;
  } | null>(null);
  const [monthlyFreeAmountYear, setMonthlyFreeAmountYear] = useState(getCurrentYear());
  const [monthlyFreeAmountLoading, setMonthlyFreeAmountLoading] = useState(false);
  const [monthlyFreeAmountResult, setMonthlyFreeAmountResult] = useState<GetMonthlyFreeAmountResponse | null>(null);
  const [salarySnapshot, setSalarySnapshot] = useState<SalarySnapshot | null>(null);
  const [salaryPreviewAmount, setSalaryPreviewAmount] = useState<string>("0");
  const [salarySnapshotLoading, setSalarySnapshotLoading] = useState(false);
  const [salaryPaying, setSalaryPaying] = useState(false);
  const [recurringForm, setRecurringForm] = useState<{
    description: string;
    amount: string;
    type: ExpenseType;
  }>({
    description: "",
    amount: "",
    type: "FIXED"
  });
  const [recurringEditing, setRecurringEditing] = useState<{
    id: string;
    type: ExpenseType;
    description: string;
    amount: string;
  } | null>(null);
  const [debtForm, setDebtForm] = useState({
    debtorId: "",
    description: "",
    totalAmount: "",
    installmentsCount: "1",
    installmentAmount: "",
    firstInstallmentDueDate: getTodayDate()
  });
  const [debtorMonthlyQuery, setDebtorMonthlyQuery] = useState({
    debtorId: "",
    month: getCurrentMonth(),
    year: getCurrentYear()
  });

  useEffect(() => {
    void loadInitialData();
  }, []);

  async function loadInitialData() {
    setBootLoading(true);
    try {
      // Vercel rule async-parallel: fetch independent resources concurrently.
      const [
        debtorsResponse,
        fixedList,
        optionalList,
        fixedTotal,
        optionalTotal
      ] = await Promise.all([
        api.listDebtors(),
        api.listRecurringExpenses("FIXED"),
        api.listRecurringExpenses("OPTIONAL"),
        api.getRecurringExpenseTotal("FIXED"),
        api.getRecurringExpenseTotal("OPTIONAL")
      ]);

      setDebtors(debtorsResponse.debtors);
      setRecurringExpenses({
        FIXED: fixedList.recurringExpenses,
        OPTIONAL: optionalList.recurringExpenses
      });
      setRecurringTotals({
        FIXED: fixedTotal.total,
        OPTIONAL: optionalTotal.total
      });

      setDebtForm((current) => ({
        ...current,
        debtorId: current.debtorId || debtorsResponse.debtors[0]?.id || ""
      }));
      setDebtorMonthlyQuery((current) => ({
        ...current,
        debtorId: current.debtorId || debtorsResponse.debtors[0]?.id || ""
      }));
      startTransition(() => {
        void loadMonthlyFreeAmount(getCurrentYear(), true);
      });
    } catch (error) {
      setNotice({ type: "error", text: toErrorMessage(error) });
    } finally {
      setBootLoading(false);
    }
  }

  async function reloadDebtors() {
    const response = await api.listDebtors();
    setDebtors(response.debtors);
    setDebtForm((current) => ({
      ...current,
      debtorId:
        response.debtors.some((debtor) => debtor.id === current.debtorId)
          ? current.debtorId
          : (response.debtors[0]?.id ?? "")
    }));
    setDebtorMonthlyQuery((current) => ({
      ...current,
      debtorId:
        response.debtors.some((debtor) => debtor.id === current.debtorId)
          ? current.debtorId
          : (response.debtors[0]?.id ?? "")
    }));
  }

  async function reloadRecurring(type?: ExpenseType) {
    if (!type) {
      const [fixedList, optionalList, fixedTotal, optionalTotal] = await Promise.all([
        api.listRecurringExpenses("FIXED"),
        api.listRecurringExpenses("OPTIONAL"),
        api.getRecurringExpenseTotal("FIXED"),
        api.getRecurringExpenseTotal("OPTIONAL")
      ]);
      setRecurringExpenses({
        FIXED: fixedList.recurringExpenses,
        OPTIONAL: optionalList.recurringExpenses
      });
      setRecurringTotals({
        FIXED: fixedTotal.total,
        OPTIONAL: optionalTotal.total
      });
      return;
    }

    const [listResponse, totalResponse] = await Promise.all([
      api.listRecurringExpenses(type),
      api.getRecurringExpenseTotal(type)
    ]);

    setRecurringExpenses((current) => ({ ...current, [type]: listResponse.recurringExpenses }));
    setRecurringTotals((current) => ({ ...current, [type]: totalResponse.total }));
  }

  async function handleCreateDebtor(event: React.FormEvent) {
    event.preventDefault();
    setNotice(null);
    try {
      await api.createDebtor({
        name: debtorForm.name.trim(),
        email: debtorForm.email.trim()
      });
      setDebtorForm({ name: "", email: "" });
      await reloadDebtors();
      setNotice({ type: "success", text: "Deudor creado correctamente." });
    } catch (error) {
      setNotice({ type: "error", text: toErrorMessage(error) });
    }
  }

  async function handleCreateSalary(event: React.FormEvent) {
    event.preventDefault();
    setNotice(null);
    try {
      const created = await api.createSalary({ amount: parseAmountInput(salaryAmount) });
      setSalaryAmount("");
      setSalaryLastCreated(created);
      await loadMonthlyFreeAmount(monthlyFreeAmountYear, true);
      setNotice({ type: "success", text: "Sueldo registrado correctamente." });
    } catch (error) {
      setNotice({ type: "error", text: toErrorMessage(error) });
    }
  }

  async function handleCreateSavingsGoal(event: React.FormEvent) {
    event.preventDefault();
    setNotice(null);
    try {
      const created = await api.createSavingsGoal({ amount: parseAmountInput(savingsGoalAmount) });
      setSavingsGoalAmount("");
      setSavingsGoalLastCreated(created);
      await loadMonthlyFreeAmount(monthlyFreeAmountYear, true);
      setNotice({ type: "success", text: "Ahorro mensual registrado correctamente." });
    } catch (error) {
      setNotice({ type: "error", text: toErrorMessage(error) });
    }
  }

  async function loadMonthlyFreeAmount(year: number, silentNotice = false) {
    setMonthlyFreeAmountLoading(true);
    if (!silentNotice) {
      setNotice(null);
    }
    try {
      const result = await api.getMonthlyFreeAmount(year);
      setMonthlyFreeAmountResult(result);
    } catch (error) {
      setMonthlyFreeAmountResult(null);
      if (!silentNotice) {
        setNotice({ type: "error", text: toErrorMessage(error) });
      }
    } finally {
      setMonthlyFreeAmountLoading(false);
    }
  }

  async function handleCreateRecurringExpense(event: React.FormEvent) {
    event.preventDefault();
    setNotice(null);
    try {
      await api.createRecurringExpense({
        description: recurringForm.description.trim(),
        amount: parseAmountInput(recurringForm.amount),
        type: recurringForm.type
      });
      const typeToRefresh = recurringForm.type;
      setRecurringForm({ description: "", amount: "", type: typeToRefresh });
      await reloadRecurring(typeToRefresh);
      setNotice({ type: "success", text: "Gasto recurrente creado." });
    } catch (error) {
      setNotice({ type: "error", text: toErrorMessage(error) });
    }
  }

  async function handleUpdateRecurringExpense(event: React.FormEvent) {
    event.preventDefault();
    if (!recurringEditing) return;
    setNotice(null);
    try {
      await api.updateRecurringExpense(recurringEditing.id, {
        description: recurringEditing.description.trim(),
        amount: parseAmountInput(recurringEditing.amount)
      });
      const typeToRefresh = recurringEditing.type;
      setRecurringEditing(null);
      await reloadRecurring(typeToRefresh);
      setNotice({ type: "success", text: "Gasto recurrente actualizado." });
    } catch (error) {
      setNotice({ type: "error", text: toErrorMessage(error) });
    }
  }

  async function deleteRecurringExpenseByTarget(target: {
    id: string;
    description: string;
    type: ExpenseType;
  }) {
    setNotice(null);
    try {
      await api.deleteRecurringExpense(target.id);
      setRecurringEditing((current) => (current?.id === target.id ? null : current));
      await reloadRecurring(target.type);
      setNotice({ type: "success", text: "Gasto recurrente eliminado." });
    } catch (error) {
      setNotice({ type: "error", text: toErrorMessage(error) });
    }
  }

  async function handleDeleteRecurringExpense() {
    if (!recurringEditing) return;
    setPendingRecurringDelete({
      id: recurringEditing.id,
      description: recurringEditing.description,
      type: recurringEditing.type
    });
  }

  async function confirmDeleteRecurringExpense() {
    if (!pendingRecurringDelete) return;
    const target = pendingRecurringDelete;
    setPendingRecurringDelete(null);
    await deleteRecurringExpenseByTarget(target);
  }

  async function handleCreateDebt(event: React.FormEvent) {
    event.preventDefault();
    setNotice(null);
    try {
      await api.createDebt({
        debt: {
          debtorId: debtForm.debtorId,
          description: debtForm.description.trim(),
          totalAmount: parseAmountInput(debtForm.totalAmount)
        },
        installments: {
          installmentsCount: Number(debtForm.installmentsCount),
          installmentAmount: parseAmountInput(debtForm.installmentAmount),
          firstInstallmentDueDate: debtForm.firstInstallmentDueDate
        }
      });

      setDebtForm((current) => ({
        ...current,
        description: "",
        totalAmount: "",
        installmentsCount: "1",
        installmentAmount: "",
        firstInstallmentDueDate: getTodayDate()
      }));
      setNotice({ type: "success", text: "Deuda creada correctamente." });

      await reloadDebtors();
    } catch (error) {
      setNotice({ type: "error", text: toErrorMessage(error) });
    }
  }

  async function handlePayInstallment(installmentId: string) {
    setNotice(null);
    try {
      await api.payInstallment(installmentId, { paymentDate: new Date().toISOString() });
      setNotice({ type: "success", text: "Cuota marcada como pagada." });
      await reloadDebtors();
      if (activeTab === "debtorProfile") {
        await runUnpaidByMonthQuery();
      }
      if (debtDetailModal) {
        startTransition(() => {
          void loadDebtDetail(debtDetailModal);
        });
      }
    } catch (error) {
      setNotice({ type: "error", text: toErrorMessage(error) });
    }
  }

  async function confirmDeleteDebt() {
    if (!pendingDebtDelete) return;

    const debtId = pendingDebtDelete.debtId;
    setPendingDebtDelete(null);
    setNotice(null);

    try {
      await api.deleteDebt(debtId);
      setNotice({ type: "success", text: "Deuda eliminada correctamente." });
      await reloadDebtors();
    } catch (error) {
      setNotice({ type: "error", text: toErrorMessage(error) });
    }
  }

  async function runUnpaidByMonthQuery() {
    if (!debtorMonthlyQuery.debtorId) {
      setNotice({ type: "error", text: "Selecciona un deudor para buscar cuotas impagas." });
      return;
    }

    await loadDebtorMonthData(debtorMonthlyQuery.debtorId, debtorMonthlyQuery.year, debtorMonthlyQuery.month);
  }

  async function loadDebtorMonthData(debtorId: string, year: number, month: number) {
    if (!debtorId) return;

    setUnpaidByMonthLoading(true);
    setSalarySnapshot(null);
    setSalaryPreviewAmount("0");
    setNotice(null);
    try {
      const result = await api.getUnpaidInstallmentsByMonth({ debtorId, year, month });
      setUnpaidByMonthResult(result);
      const monthlyFreeAmount = await api.getMonthlyFreeAmount(year);
      const totalInstallments = result.installments.reduce((sum, item) => sum + Number(item.amount), 0);
      const preview = Number(monthlyFreeAmount.monthlyFreeAmount) / 2 - totalInstallments;
      setSalaryPreviewAmount(String(preview));
      setSalarySnapshotLoading(true);
      try {
        const snapshot = await api.getSalarySnapshot({
          debtorId,
          year,
          month
        });
        setSalarySnapshot(snapshot);
      } catch (error) {
        if (error instanceof ApiClientError && error.status === 404) {
          setSalarySnapshot(null);
        } else {
          throw error;
        }
      } finally {
        setSalarySnapshotLoading(false);
      }
    } catch (error) {
      setUnpaidByMonthResult(null);
      setNotice({ type: "error", text: toErrorMessage(error) });
    } finally {
      setUnpaidByMonthLoading(false);
    }
  }

  async function handlePayMonthlySalary() {
    if (!debtorMonthlyQuery.debtorId) return;
    setSalaryPaying(true);
    setNotice(null);
    try {
      const response = await api.payMonthlySalary({
        debtorId: debtorMonthlyQuery.debtorId,
        year: debtorMonthlyQuery.year,
        month: debtorMonthlyQuery.month,
        paymentDate: new Date().toISOString()
      });
      setSalarySnapshot(response.snapshot);
      setNotice({ type: "success", text: "Sueldo mensual pagado y snapshot guardado." });
    } catch (error) {
      setNotice({ type: "error", text: toErrorMessage(error) });
    } finally {
      setSalaryPaying(false);
    }
  }

  async function handleDownloadMonthlyPdf() {
    if (!debtorMonthlyQuery.debtorId) return;
    setNotice(null);
    try {
      const pdfBlob = await api.downloadMonthlySummaryPdf({
        debtorId: debtorMonthlyQuery.debtorId,
        year: debtorMonthlyQuery.year,
        month: debtorMonthlyQuery.month
      });
      const url = URL.createObjectURL(pdfBlob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `monthly-summary-${debtorMonthlyQuery.debtorId}-${debtorMonthlyQuery.year}-${debtorMonthlyQuery.month}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    } catch (error) {
      setNotice({ type: "error", text: toErrorMessage(error) });
    }
  }

  async function loadDebtDetail(target: Exclude<DebtDetailModalState, null>) {
    setDebtDetailModal(target);
    setDebtDetail(null);
    setDebtDetailPage(1);
    setDebtDetailLoading(true);
    setNotice(null);

    try {
      const response: GetDebtDetailResponse = await api.getDebtDetail(target.debtId);
      setDebtDetailModal((current) =>
        current
          ? {
              ...current,
              debtorId: response.id,
              debtorName: response.name,
              debtorEmail: response.email
            }
          : current
      );
      setDebtDetail(response.debt);
    } catch (error) {
      setNotice({ type: "error", text: toErrorMessage(error) });
      setDebtDetailModal(null);
    } finally {
      setDebtDetailLoading(false);
    }
  }

  function openDebtorProfile(debtorId: string) {
    const query = {
      debtorId,
      month: debtorMonthlyQuery.month,
      year: debtorMonthlyQuery.year
    };
    setDebtorMonthlyQuery((current) => ({
      ...current,
      debtorId
    }));
    setActiveTab("debtorProfile");
    startTransition(() => {
      void loadDebtorMonthData(query.debtorId, query.year, query.month);
    });
  }

  function openDebtDetailFromInstallment(item: { debtId: string }) {
    if (!unpaidByMonthResult) return;
    void loadDebtDetail({
      debtorId: unpaidByMonthResult.debtorId,
      debtorName: unpaidByMonthResult.debtorName,
      debtorEmail: unpaidByMonthResult.debtorEmail,
      debtId: item.debtId
    });
  }

  function openDebtsFromDebtorProfile() {
    if (!debtorMonthlyQuery.debtorId) return;
    const selectedDebtor =
      debtors.find((debtor) => debtor.id === debtorMonthlyQuery.debtorId) ??
      (unpaidByMonthResult
        ? {
            id: unpaidByMonthResult.debtorId,
            name: unpaidByMonthResult.debtorName,
            email: unpaidByMonthResult.debtorEmail,
            totalDebt: "0"
          }
        : null);

    if (!selectedDebtor) return;

    setDebtCreationDebtorContext({
      id: selectedDebtor.id,
      name: selectedDebtor.name,
      email: selectedDebtor.email
    });
    setDebtForm((current) => ({ ...current, debtorId: selectedDebtor.id }));
    setActiveTab("debts");
  }

  const totalRecurring = Number(recurringTotals.FIXED || 0) + Number(recurringTotals.OPTIONAL || 0);
  const debtDetailTotalPages = debtDetail
    ? Math.max(1, Math.ceil(debtDetail.installments.length / DEBT_DETAIL_PAGE_SIZE))
    : 1;
  const debtDetailVisibleInstallments = debtDetail
    ? debtDetail.installments.slice(
        (debtDetailPage - 1) * DEBT_DETAIL_PAGE_SIZE,
        debtDetailPage * DEBT_DETAIL_PAGE_SIZE
      )
    : [];

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <h1>Balance Hub</h1>
        </div>
      </header>

      <nav className="tabs" aria-label="Secciones">
        {TAB_OPTIONS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={tab.key === activeTab ? "tab active" : "tab"}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {notice ? (
        <div className={notice.type === "error" ? "notice error" : "notice success"} role="status">
          {notice.text}
        </div>
      ) : null}

      {recurringEditing ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setRecurringEditing(null)}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-recurring-title"
            onClick={(event) => event.stopPropagation()}
          >
            <form className="form-grid" onSubmit={handleUpdateRecurringExpense}>
              <h3 id="edit-recurring-title">Editar gasto ({getExpenseTypeLabel(recurringEditing.type)})</h3>
              <label>
                Descripción
                <input
                  value={recurringEditing.description}
                  onChange={(event) =>
                    setRecurringEditing((current) =>
                      current ? { ...current, description: event.target.value } : current
                    )
                  }
                  required
                />
              </label>
              <label>
                Monto
                <input
                  type="text"
                  inputMode="numeric"
                  value={recurringEditing.amount}
                  onChange={(event) =>
                    setRecurringEditing((current) =>
                      current ? { ...current, amount: formatAmountInput(event.target.value) } : current
                    )
                  }
                  required
                />
              </label>
              <div className="form-actions split">
                <button type="submit">Guardar cambios</button>
                <button type="button" className="danger" onClick={() => void handleDeleteRecurringExpense()}>
                  Eliminar
                </button>
                <button type="button" className="secondary" onClick={() => setRecurringEditing(null)}>
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {pendingRecurringDelete ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setPendingRecurringDelete(null)}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-recurring-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 id="delete-recurring-title">Confirmar eliminación</h3>
            <p>
              ¿Deseas eliminar <strong>{pendingRecurringDelete.description}</strong> (
              {getExpenseTypeLabel(pendingRecurringDelete.type)})?
            </p>
            <div className="form-actions split">
              <button type="button" className="danger" onClick={() => void confirmDeleteRecurringExpense()}>
                Sí, eliminar
              </button>
              <button type="button" className="secondary" onClick={() => setPendingRecurringDelete(null)}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {pendingDebtDelete ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setPendingDebtDelete(null)}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-debt-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 id="delete-debt-title">Confirmar eliminación de deuda</h3>
            <p>
              ¿Deseas eliminar la deuda <strong>{pendingDebtDelete.debtDescription}</strong>? Esta acción elimina
              también sus cuotas.
            </p>
            <div className="form-actions split">
              <button type="button" className="danger" onClick={() => void confirmDeleteDebt()}>
                Sí, eliminar deuda
              </button>
              <button type="button" className="secondary" onClick={() => setPendingDebtDelete(null)}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {debtDetailModal ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setDebtDetailModal(null)}>
          <div
            className="modal large"
            role="dialog"
            aria-modal="true"
            aria-labelledby="debt-detail-title"
            onClick={(event) => event.stopPropagation()}
          >
            {debtDetailLoading ? (
              <p className="muted">Cargando detalle de deuda...</p>
            ) : debtDetail ? (
              <div className="debts-result">
                <div className="result-header">
                  <h3 id="debt-detail-title">
                    {debtDetailModal.debtorName} <span className="muted">({debtDetailModal.debtorEmail})</span>
                  </h3>
                  <p className="mono">{debtDetailModal.debtorId}</p>
                </div>

                <article className="debt-card debt-detail-card">
                  <div className="debt-card-header">
                    <div>
                      <h4>{debtDetail.description}</h4>
                      <p className="muted">{formatCurrency(debtDetail.totalAmount)}</p>
                    </div>
                    <div className="item-actions">
                      <span className={debtDetail.settled ? "badge success" : "badge warning"}>
                        {debtDetail.settled ? "Saldada" : "Pendiente"}
                      </span>
                      <button
                        type="button"
                        className="danger"
                        onClick={() => {
                          setDebtDetailModal(null);
                          setPendingDebtDelete({
                            debtId: debtDetail.id,
                            debtDescription: debtDetail.description
                          });
                        }}
                      >
                        Eliminar deuda
                      </button>
                    </div>
                  </div>
                  <p className="muted">
                    Creada: {formatDate(debtDetail.createdAt)} | ID: <span className="mono">{debtDetail.id}</span>
                  </p>

                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Vence</th>
                          <th>Monto</th>
                          <th>Pagada</th>
                          <th>Acción</th>
                        </tr>
                      </thead>
                      <tbody>
                        {debtDetailVisibleInstallments.map((installment) => (
                          <tr key={installment.id}>
                            <td>{installment.number}</td>
                            <td>{formatDate(installment.dueDate)}</td>
                            <td>{formatCurrency(installment.amount)}</td>
                            <td>{installment.paidAt ? formatDate(installment.paidAt) : "No"}</td>
                            <td>
                              {installment.paidAt ? (
                                <span className="muted">Sin acción</span>
                              ) : (
                                <button
                                  type="button"
                                  className="secondary"
                                  onClick={() => void handlePayInstallment(installment.id)}
                                >
                                  Pagar ahora
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {debtDetail.installments.length > DEBT_DETAIL_PAGE_SIZE ? (
                    <div className="pagination-controls">
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => setDebtDetailPage((current) => Math.max(1, current - 1))}
                        disabled={debtDetailPage <= 1}
                      >
                        Anterior
                      </button>
                      <p className="muted">
                        Página {debtDetailPage} de {debtDetailTotalPages}
                      </p>
                      <button
                        type="button"
                        className="secondary"
                        onClick={() =>
                          setDebtDetailPage((current) => Math.min(debtDetailTotalPages, current + 1))
                        }
                        disabled={debtDetailPage >= debtDetailTotalPages}
                      >
                        Siguiente
                      </button>
                    </div>
                  ) : null}
                </article>
              </div>
            ) : (
              <p className="muted">No se encontró la deuda seleccionada.</p>
            )}

            <div className="form-actions split">
              <button type="button" className="secondary" onClick={() => setDebtDetailModal(null)}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {bootLoading ? <div className="panel">Cargando datos iniciales...</div> : null}

      {!bootLoading && (
        <main className="grid">
          {activeTab === "debtors" && (
            <Section title="Deudores" description="Crea y visualiza deudores disponibles para asociar deudas.">
              <form className="form-grid" onSubmit={handleCreateDebtor}>
                <label>
                  Nombre
                  <input
                    value={debtorForm.name}
                    onChange={(event) => setDebtorForm((c) => ({ ...c, name: event.target.value }))}
                    placeholder="Juan Pérez"
                    required
                  />
                </label>
                <label>
                  Email
                  <input
                    type="email"
                    value={debtorForm.email}
                    onChange={(event) => setDebtorForm((c) => ({ ...c, email: event.target.value }))}
                    placeholder="juan@email.com"
                    required
                  />
                </label>
                <div className="form-actions">
                  <button type="submit">Crear deudor</button>
                </div>
              </form>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Nombre</th>
                      <th>Email</th>
                      <th>Deuda pendiente</th>
                      <th>ID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {debtors.length === 0 ? (
                      <tr>
                        <td colSpan={4}>No hay deudores registrados.</td>
                      </tr>
                    ) : (
                      debtors.map((debtor) => (
                        <tr key={debtor.id}>
                          <td>
                            <button
                              type="button"
                              className="link-btn"
                              onClick={() => openDebtorProfile(debtor.id)}
                            >
                              {debtor.name}
                            </button>
                          </td>
                          <td>{debtor.email}</td>
                          <td>{formatCurrency(debtor.totalDebt)}</td>
                          <td className="mono">{debtor.id}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Section>
          )}

          {activeTab === "debtorProfile" && (
            <>
              <section className="panel">
                <form
                  className="form-grid debtor-profile-filters"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void runUnpaidByMonthQuery();
                  }}
                >
                  <label>
                    Deudor
                    <select
                      value={debtorMonthlyQuery.debtorId}
                      onChange={(event) =>
                        setDebtorMonthlyQuery((current) => ({ ...current, debtorId: event.target.value }))
                      }
                      required
                    >
                      <option value="" disabled>
                        Selecciona un deudor
                      </option>
                      {debtors.map((debtor) => (
                        <option key={debtor.id} value={debtor.id}>
                          {debtor.name} ({debtor.email})
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Mes
                    <select
                      value={String(debtorMonthlyQuery.month)}
                      onChange={(event) =>
                        setDebtorMonthlyQuery((current) => ({
                          ...current,
                          month: Number(event.target.value)
                        }))
                      }
                      required
                    >
                      {MONTH_OPTIONS.map((month) => (
                        <option key={month.value} value={month.value}>
                          {month.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Año
                    <input
                      type="number"
                      min="1970"
                      max="9999"
                      value={debtorMonthlyQuery.year}
                      onChange={(event) =>
                        setDebtorMonthlyQuery((current) => ({
                          ...current,
                          year: Number(event.target.value)
                        }))
                      }
                      required
                    />
                  </label>
                  <div className="form-actions">
                    <button type="submit">Buscar cuotas impagas</button>
                  </div>
                  <div className="form-actions">
                    <button type="button" className="secondary" onClick={openDebtsFromDebtorProfile}>
                      Crear deuda
                    </button>
                  </div>
                </form>
              </section>

              <section className="panel">
                {unpaidByMonthResult ? (
                  <div className="profile-header">
                    <h2>{unpaidByMonthResult.debtorName}</h2>
                    <p className="muted">{unpaidByMonthResult.debtorEmail}</p>
                  </div>
                ) : null}

                <div className="info-card">
                  <p>
                    <strong>Total cuotas impagas:</strong>{" "}
                    {unpaidByMonthResult ? formatCurrency(unpaidByMonthResult.totalAmount) : "$0"}
                  </p>
                  <p>
                    <strong>Sueldo (snapshot):</strong>{" "}
                    {formatCurrency(salarySnapshot?.salaryColumnAmount ?? salaryPreviewAmount)}
                    {salarySnapshot ? ` (${salarySnapshot.status})` : " (preview)"}
                  </p>
                  <p className="muted">
                    Resultado para {getMonthLabel(debtorMonthlyQuery.month)} {debtorMonthlyQuery.year}
                  </p>
                  <div className="form-actions split" style={{ marginTop: "0.6rem" }}>
                    <button
                      type="button"
                      onClick={() => void handlePayMonthlySalary()}
                      disabled={salaryPaying || salarySnapshotLoading}
                    >
                      {salaryPaying ? "Pagando..." : "Pagar sueldo"}
                    </button>
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => void handleDownloadMonthlyPdf()}
                      disabled={!debtorMonthlyQuery.debtorId || unpaidByMonthLoading}
                    >
                      Descargar PDF
                    </button>
                  </div>
                </div>

                {unpaidByMonthLoading ? <p className="muted">Consultando cuotas impagas...</p> : null}

                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Vencimiento</th>
                        <th>Monto</th>
                        <th>Estado</th>
                        <th>Pertenece a</th>
                        <th>Cuota</th>
                        <th>Sueldo</th>
                        <th>Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {!unpaidByMonthResult || unpaidByMonthResult.installments.length === 0 ? (
                        <tr>
                          <td colSpan={7}>No hay cuotas para este filtro.</td>
                        </tr>
                      ) : (
                        unpaidByMonthResult.installments.map((item) => (
                          <tr key={item.installmentId}>
                            <td>{formatDate(item.dueDate)}</td>
                            <td>{formatCurrency(item.amount)}</td>
                            <td>
                              <span className={item.paid ? "badge success" : "badge warning"}>
                                {item.paid ? "Pagada" : "Pendiente"}
                              </span>
                            </td>
                            <td>
                              <button
                                type="button"
                                className="link-btn"
                                onClick={() => openDebtDetailFromInstallment(item)}
                              >
                                {item.debtDescription}
                              </button>
                            </td>
                            <td>
                              {item.installmentNumber}/{item.totalInstallments}
                            </td>
                            <td>{formatCurrency(salarySnapshot?.salaryColumnAmount ?? salaryPreviewAmount)}</td>
                            <td>
                              {item.paid ? (
                                <span className="muted">Sin acción</span>
                              ) : (
                                <button
                                  type="button"
                                  className="secondary"
                                  onClick={() => void handlePayInstallment(item.installmentId)}
                                >
                                  Pagar
                                </button>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}

          {activeTab === "salary" && (
            <Section
              title="Sueldos y Ahorro"
              description="Define sueldo actual, ahorro mensual y revisa el monto libre por mes."
            >
              <div className="two-columns">
                <div className="subpanel">
                  <h3>Registrar sueldo actual</h3>
                  <form className="form-grid compact" onSubmit={handleCreateSalary}>
                    <label>
                      Monto
                      <input
                        type="text"
                        inputMode="numeric"
                        value={salaryAmount}
                        onChange={(event) => setSalaryAmount(formatAmountInput(event.target.value))}
                        placeholder="1500000"
                        required
                      />
                    </label>
                    <div className="form-actions">
                      <button type="submit">Guardar sueldo</button>
                    </div>
                  </form>
                  {salaryLastCreated ? (
                    <div className="info-card">
                      <p>
                        <strong>Último sueldo creado:</strong> {formatCurrency(salaryLastCreated.amount)}
                      </p>
                      <p>
                        <strong>Fecha:</strong> {formatDate(salaryLastCreated.createdAt)}
                      </p>
                    </div>
                  ) : null}
                </div>

                <div className="subpanel">
                  <h3>Registrar ahorro mensual</h3>
                  <form className="form-grid compact" onSubmit={handleCreateSavingsGoal}>
                    <label>
                      Monto ahorro
                      <input
                        type="text"
                        inputMode="numeric"
                        value={savingsGoalAmount}
                        onChange={(event) => setSavingsGoalAmount(formatAmountInput(event.target.value))}
                        placeholder="300000"
                        required
                      />
                    </label>
                    <div className="form-actions">
                      <button type="submit">Guardar ahorro</button>
                    </div>
                  </form>
                  {savingsGoalLastCreated ? (
                    <div className="info-card">
                      <p>
                        <strong>Último ahorro creado:</strong> {formatCurrency(savingsGoalLastCreated.amount)}
                      </p>
                      <p>
                        <strong>Fecha:</strong> {formatDate(savingsGoalLastCreated.createdAt)}
                      </p>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="subpanel">
                <h3>Monto libre por mes</h3>
                <form
                  className="form-grid compact"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void loadMonthlyFreeAmount(monthlyFreeAmountYear);
                  }}
                >
                  <label>
                    Año
                    <input
                      type="number"
                      min="1970"
                      max="9999"
                      value={monthlyFreeAmountYear}
                      onChange={(event) => setMonthlyFreeAmountYear(Number(event.target.value))}
                      required
                    />
                  </label>
                  <div className="form-actions">
                    <button type="submit">Consultar</button>
                  </div>
                </form>

                <div className="summary-row">
                  <div className="stat">
                    <span>Sueldo actual</span>
                    <strong>{formatCurrency(monthlyFreeAmountResult?.currentSalary ?? 0)}</strong>
                  </div>
                  <div className="stat">
                    <span>Ahorro mensual</span>
                    <strong>{formatCurrency(monthlyFreeAmountResult?.monthlySavingsGoal ?? 0)}</strong>
                  </div>
                  <div className="stat expense-fixed">
                    <span>Gastos fijos</span>
                    <strong>{formatCurrency(monthlyFreeAmountResult?.monthlyFixedExpenses ?? 0)}</strong>
                  </div>
                  <div className="stat expense-optional">
                    <span>Gastos opcionales</span>
                    <strong>{formatCurrency(monthlyFreeAmountResult?.monthlyOptionalExpenses ?? 0)}</strong>
                  </div>
                  <div className="stat">
                    <span>Monto libre mensual</span>
                    <strong>{formatCurrency(monthlyFreeAmountResult?.monthlyFreeAmount ?? 0)}</strong>
                  </div>
                </div>

                {monthlyFreeAmountLoading ? <p className="muted">Calculando monto libre...</p> : null}

                {monthlyFreeAmountResult ? (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Mes</th>
                          <th>Año</th>
                          <th>Monto libre</th>
                        </tr>
                      </thead>
                      <tbody>
                        {monthlyFreeAmountResult.months.map((item) => (
                          <tr key={`${item.year}-${item.month}`}>
                            <td>{MONTH_OPTIONS.find((month) => month.value === item.month)?.label ?? item.month}</td>
                            <td>{item.year}</td>
                            <td>{formatCurrency(item.freeAmount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="muted">Consulta un año para ver el monto libre por mes.</p>
                )}
              </div>
            </Section>
          )}

          {activeTab === "recurring" && (
            <Section
              title="Gastos Recurrentes"
              description="Crear, listar, totalizar y actualizar gastos fijos y opcionales."
            >
              <div className="summary-row">
                <div className="stat expense-fixed">
                  <span>Fijos</span>
                  <strong>{formatCurrency(recurringTotals.FIXED)}</strong>
                </div>
                <div className="stat expense-optional">
                  <span>Opcionales</span>
                  <strong>{formatCurrency(recurringTotals.OPTIONAL)}</strong>
                </div>
                <div className="stat">
                  <span>Total</span>
                  <strong>{formatCurrency(totalRecurring)}</strong>
                </div>
              </div>

              <form className="form-grid" onSubmit={handleCreateRecurringExpense}>
                <label>
                  Descripción
                  <input
                    value={recurringForm.description}
                    onChange={(event) => setRecurringForm((c) => ({ ...c, description: event.target.value }))}
                    placeholder="Arriendo / Netflix"
                    required
                  />
                </label>
                <label>
                  Monto
                  <input
                    type="text"
                    inputMode="numeric"
                    value={recurringForm.amount}
                    onChange={(event) =>
                      setRecurringForm((c) => ({ ...c, amount: formatAmountInput(event.target.value) }))
                    }
                    placeholder="350000"
                    required
                  />
                </label>
                <label>
                  Tipo
                  <select
                    value={recurringForm.type}
                    onChange={(event) =>
                      setRecurringForm((c) => ({ ...c, type: event.target.value as ExpenseType }))
                    }
                  >
                    <option value="FIXED">{getExpenseTypeLabel("FIXED")}</option>
                    <option value="OPTIONAL">{getExpenseTypeLabel("OPTIONAL")}</option>
                  </select>
                </label>
                <div className="form-actions">
                  <button type="submit">Crear gasto</button>
                </div>
              </form>

              <div className="two-columns">
                {(["FIXED", "OPTIONAL"] as ExpenseType[]).map((type) => (
                  <div className={`subpanel ${getExpenseTypeClassName(type)}`} key={type}>
                    <div className="subpanel-title">
                      <h3>{getExpenseTypeLabel(type)}</h3>
                      <button type="button" className="secondary" onClick={() => void reloadRecurring(type)}>
                        Recargar
                      </button>
                    </div>
                    <ul className="list">
                      {recurringExpenses[type].length === 0 ? (
                        <li className="list-item empty">Sin gastos de este tipo.</li>
                      ) : (
                        recurringExpenses[type].map((item) => (
                          <li key={item.id} className={`list-item ${getExpenseTypeClassName(type)}`}>
                            <div>
                              <p className="list-title">{item.description}</p>
                              <p className="muted">{formatCurrency(item.amount)}</p>
                              <p className="mono">{item.id}</p>
                            </div>
                            <div className="item-actions">
                              <button
                                type="button"
                                className="icon-btn secondary"
                                aria-label={`Editar ${item.description}`}
                                title="Editar"
                                onClick={() =>
                                  setRecurringEditing({
                                    id: item.id,
                                    type,
                                    description: item.description,
                                    amount: formatAmountInput(String(Number(item.amount)))
                                  })
                                }
                              >
                                ✎
                              </button>
                              <button
                                type="button"
                                className="icon-btn danger"
                                aria-label={`Eliminar ${item.description}`}
                                title="Eliminar"
                                onClick={() =>
                                  setPendingRecurringDelete({
                                    id: item.id,
                                    description: item.description,
                                    type
                                  })
                                }
                              >
                                ×
                              </button>
                            </div>
                          </li>
                        ))
                      )}
                    </ul>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {activeTab === "debts" && (
            <Section
              title="Deudas y Cuotas"
              description="Crear deudas y gestionar sus cuotas desde el detalle."
            >
              <h3>Crear deuda</h3>
              <form className="form-grid" onSubmit={handleCreateDebt}>
                {activeTab === "debts" && debtCreationDebtorContext ? (
                  <label>
                    Deudor
                    <input
                      value={`${debtCreationDebtorContext.name} (${debtCreationDebtorContext.email})`}
                      readOnly
                    />
                  </label>
                ) : (
                  <label>
                    Deudor
                    <select
                      value={debtForm.debtorId}
                      onChange={(event) => {
                        setDebtCreationDebtorContext(null);
                        setDebtForm((c) => ({ ...c, debtorId: event.target.value }));
                      }}
                      required
                    >
                      <option value="" disabled>
                        Selecciona un deudor
                      </option>
                      {debtors.map((debtor) => (
                        <option key={debtor.id} value={debtor.id}>
                          {debtor.name} ({debtor.email})
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <label>
                  Descripción
                  <input
                    value={debtForm.description}
                    onChange={(event) => setDebtForm((c) => ({ ...c, description: event.target.value }))}
                    placeholder="Laptop / préstamo / tarjeta"
                    required
                  />
                </label>
                <label>
                  Monto total
                  <input
                    type="text"
                    inputMode="numeric"
                    value={debtForm.totalAmount}
                    onChange={(event) =>
                      setDebtForm((c) => ({ ...c, totalAmount: formatAmountInput(event.target.value) }))
                    }
                    required
                  />
                </label>
                <label>
                  Cantidad de cuotas
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={debtForm.installmentsCount}
                    onChange={(event) =>
                      setDebtForm((c) => ({ ...c, installmentsCount: event.target.value }))
                    }
                    required
                  />
                </label>
                <label>
                  Monto por cuota
                  <input
                    type="text"
                    inputMode="numeric"
                    value={debtForm.installmentAmount}
                    onChange={(event) =>
                      setDebtForm((c) => ({
                        ...c,
                        installmentAmount: formatAmountInput(event.target.value)
                      }))
                    }
                    required
                  />
                </label>
                <label>
                  Primera cuota (vencimiento)
                  <input
                    type="date"
                    value={debtForm.firstInstallmentDueDate}
                    onChange={(event) =>
                      setDebtForm((c) => ({ ...c, firstInstallmentDueDate: event.target.value }))
                    }
                    required
                  />
                </label>
                <div className="form-actions">
                  <button type="submit" disabled={debtors.length === 0}>
                    Crear deuda
                  </button>
                </div>
              </form>
            </Section>
          )}
        </main>
      )}
    </div>
  );
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "Ocurrió un error inesperado.";
}

export default App;
