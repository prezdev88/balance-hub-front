import { startTransition, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { ApiClientError, api } from "./lib/api";
import { generateMonthlySummaryPdfBlob } from "./lib/monthlySummaryPdf";
import type {
  DebtorAccessResponse,
  GetHouseholdBudgetSummaryResponse,
  HouseholdBudgetCategory,
  LoginResponse,
  Debt,
  Debtor,
  ExpenseType,
  GetMonthlyFreeAmountResponse,
  GetDebtDetailResponse,
  GetUnpaidInstallmentsByMonthResponse,
  PendingItem,
  RecurringExpense,
  SalarySnapshot,
  UpdateDebtRequest
} from "./types";

type TabKey = "debtors" | "debtorProfile" | "debts" | "pendings" | "recurring" | "salary" | "household" | "themes";
type ThemeMode = "light" | "dark";
type HouseholdSubTab = "spend" | "settings";
type ThemeKey =
  | "ocean"
  | "forest"
  | "sunset"
  | "sand"
  | "slate"
  | "mint"
  | "midnight"
  | "neon"
  | "ember"
  | "violet"
  | "graphite"
  | "aurora";
type SessionState = LoginResponse | null;

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

type PendingInstallmentPayment = {
  installmentId: string;
  amount: string;
  dueDate: string | null;
} | null;

type PendingSalaryPayment = {
  debtorName: string;
  year: number;
  month: number;
  amount: string;
} | null;

type PendingDebtorAccessAction = {
  debtorId: string;
  debtorName: string;
  action: "grant" | "resetPassword";
} | null;

type DebtDetailModalState = {
  debtorId: string;
  debtorName: string;
  debtorEmail: string;
  debtId: string;
} | null;

type DebtEditState = {
  debt: Debt;
  debtorId: string;
  debtorName: string;
  debtorEmail: string;
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
const SESSION_STORAGE_KEY = "balance-hub-session-v1";
const THEME_STORAGE_KEY = "balance-hub-theme-v2";
const THEME_OPTIONS: Array<{ key: ThemeKey; label: string; base: ThemeMode }> = [
  { key: "ocean", label: "Ocean", base: "light" },
  { key: "forest", label: "Forest", base: "light" },
  { key: "sunset", label: "Sunset", base: "light" },
  { key: "sand", label: "Sand", base: "light" },
  { key: "slate", label: "Slate", base: "light" },
  { key: "mint", label: "Mint", base: "light" },
  { key: "midnight", label: "Midnight", base: "dark" },
  { key: "neon", label: "Neon", base: "dark" },
  { key: "ember", label: "Ember", base: "dark" },
  { key: "violet", label: "Violet", base: "dark" },
  { key: "graphite", label: "Graphite", base: "dark" },
  { key: "aurora", label: "Aurora", base: "dark" }
];
const ADMIN_TABS: Array<{ key: TabKey; label: string }> = [
  { key: "debtors", label: "Deudores" },
  { key: "debtorProfile", label: "Perfil deudor" },
  { key: "pendings", label: "Pendientes" },
  { key: "recurring", label: "Gastos recurrentes" },
  { key: "salary", label: "Sueldos" },
  { key: "household", label: "Verduras y mercadería" },
  { key: "themes", label: "Temas" }
];
const DEBTOR_TABS: Array<{ key: TabKey; label: string }> = [
  { key: "debtorProfile", label: "Mi perfil" },
  { key: "themes", label: "Temas" }
];

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

function formatSignedAmountInput(value: string): string {
  const isNegative = /^\s*-/.test(value);
  const digitsOnly = value.replace(/\D/g, "");
  if (!digitsOnly) return isNegative ? "-" : "";
  const formatted = new Intl.NumberFormat("es-CL", {
    maximumFractionDigits: 0
  }).format(Number(digitsOnly));
  return isNegative ? `-${formatted}` : formatted;
}

function parseSignedAmountInput(value: string): number {
  const isNegative = /^\s*-/.test(value);
  const digitsOnly = value.replace(/\D/g, "");
  const amount = digitsOnly ? Number(digitsOnly) : 0;
  return isNegative ? -amount : amount;
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

function formatDateTime(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return formatDate(value);

  const day = String(date.getDate()).padStart(2, "0");
  const month = MONTH_ABBREVIATIONS[date.getMonth()];
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${day}-${month}-${year} ${hours}:${minutes}`;
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

function getHouseholdCategoryLabel(category: HouseholdBudgetCategory): string {
  return category === "VEGETABLES" ? "Verduras" : "Mercadería";
}

function getHouseholdCategoryIcon(category: HouseholdBudgetCategory): string {
  return category === "VEGETABLES" ? "🥦" : "🛒";
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function readStoredSession(): SessionState {
  if (typeof window === "undefined") return null;

  const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as LoginResponse;
    if (!parsed.accessToken || !parsed.role || !parsed.email) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function readStoredThemeKey(): ThemeKey {
  if (typeof window === "undefined") return "ocean";
  const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (!saved) return "ocean";
  const found = THEME_OPTIONS.find((theme) => theme.key === saved);
  return found?.key ?? "ocean";
}

function getThemeBase(themeKey: ThemeKey): ThemeMode {
  return THEME_OPTIONS.find((theme) => theme.key === themeKey)?.base ?? "light";
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

function MobileMenuIcon({
  name
}: {
  name: "debtors" | "debtorProfile" | "debts" | "pendings" | "recurring" | "salary" | "household" | "themes" | "theme" | "logout";
}) {
  const common = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2 };

  if (name === "debtors") return <svg {...common}><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" /><path d="M20 8v6" /><path d="M23 11h-6" /></svg>;
  if (name === "debtorProfile") return <svg {...common}><path d="M20 21a8 8 0 1 0-16 0" /><circle cx="12" cy="7" r="4" /></svg>;
  if (name === "debts") return <svg {...common}><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /><path d="M6 15h4" /></svg>;
  if (name === "pendings") return <svg {...common}><path d="M9 6h11" /><path d="M9 12h11" /><path d="M9 18h11" /><path d="M3 6h.01" /><path d="M3 12h.01" /><path d="M3 18h.01" /></svg>;
  if (name === "recurring") return <svg {...common}><path d="M3 12a9 9 0 0 1 15-6l2 2" /><path d="M21 12a9 9 0 0 1-15 6l-2-2" /><path d="M5 8h5V3" /><path d="M19 16h-5v5" /></svg>;
  if (name === "salary") return <svg {...common}><path d="M12 1v22" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7H14.5a3.5 3.5 0 0 1 0 7H6" /></svg>;
  if (name === "household") return <svg {...common}><path d="M3 10h18" /><path d="M5 10l1.5 9h11L19 10" /><path d="M8 10V6a4 4 0 0 1 8 0v4" /></svg>;
  if (name === "themes") return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M12 3v18" /><path d="M3 12h18" /><path d="M5 5l14 14" /></svg>;
  if (name === "theme") return <svg {...common}><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z" /></svg>;
  return <svg {...common}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" /></svg>;
}

function App() {
  const [session, setSession] = useState<SessionState>(() => readStoredSession());
  const [themeKey, setThemeKey] = useState<ThemeKey>(() => readStoredThemeKey());
  const themeMode: ThemeMode = getThemeBase(themeKey);
  const [activeTab, setActiveTab] = useState<TabKey>(() =>
    readStoredSession()?.role === "DEBTOR" ? "debtorProfile" : "debtors"
  );
  const [bootLoading, setBootLoading] = useState(Boolean(readStoredSession()));
  const [notice, setNotice] = useState<AppNotice>(null);
  const [fabMenuOpen, setFabMenuOpen] = useState(false);
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [loginLoading, setLoginLoading] = useState(false);
  const [passwordChangeForm, setPasswordChangeForm] = useState({
    newPassword: "",
    confirmPassword: ""
  });
  const [passwordChangeLoading, setPasswordChangeLoading] = useState(false);

  const [debtors, setDebtors] = useState<Debtor[]>([]);
  const [pendings, setPendings] = useState<PendingItem[]>([]);
  const [recurringExpenses, setRecurringExpenses] = useState<RecurringState>(EMPTY_RECURRING);
  const [recurringTotals, setRecurringTotals] = useState<RecurringTotals>(EMPTY_TOTALS);
  const [pendingRecurringDelete, setPendingRecurringDelete] = useState<PendingRecurringDelete>(null);
  const [pendingDebtDelete, setPendingDebtDelete] = useState<PendingDebtDelete>(null);
  const [pendingInstallmentPayment, setPendingInstallmentPayment] = useState<PendingInstallmentPayment>(null);
  const [pendingSalaryPayment, setPendingSalaryPayment] = useState<PendingSalaryPayment>(null);
  const [pendingDebtorAccessAction, setPendingDebtorAccessAction] = useState<PendingDebtorAccessAction>(null);
  const [debtorAccessPassword, setDebtorAccessPassword] = useState("");
  const [debtorAccessResult, setDebtorAccessResult] = useState<DebtorAccessResponse | null>(null);
  const [unpaidByMonthLoading, setUnpaidByMonthLoading] = useState(false);
  const [unpaidByMonthResult, setUnpaidByMonthResult] = useState<GetUnpaidInstallmentsByMonthResponse | null>(null);
  const [debtDetailModal, setDebtDetailModal] = useState<DebtDetailModalState>(null);
  const [debtDetailLoading, setDebtDetailLoading] = useState(false);
  const [debtDetail, setDebtDetail] = useState<Debt | null>(null);
  const [debtDetailPage, setDebtDetailPage] = useState(1);
  const [debtEditModal, setDebtEditModal] = useState<DebtEditState>(null);
  const [debtEditConfirmModal, setDebtEditConfirmModal] = useState<DebtEditState>(null);
  const [debtCreationDebtorContext, setDebtCreationDebtorContext] = useState<DebtCreationDebtorContext>(null);
  const [createDebtorModalOpen, setCreateDebtorModalOpen] = useState(false);

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
  const [salarySnapshot, setSalarySnapshot] = useState<SalarySnapshot | null>(null);
  const [salaryPreviewAmount, setSalaryPreviewAmount] = useState<string>("0");
  const [salarySnapshotLoading, setSalarySnapshotLoading] = useState(false);
  const [salaryPaying, setSalaryPaying] = useState(false);
  const [monthlyFreeAmountLoading, setMonthlyFreeAmountLoading] = useState(false);
  const [monthlyFreeAmountResult, setMonthlyFreeAmountResult] = useState<GetMonthlyFreeAmountResponse | null>(null);
  const [householdBudgetLoading, setHouseholdBudgetLoading] = useState(false);
  const [householdBudgetResult, setHouseholdBudgetResult] = useState<GetHouseholdBudgetSummaryResponse | null>(null);
  const [householdSubTab, setHouseholdSubTab] = useState<HouseholdSubTab>("spend");
  const [householdBudgetForm, setHouseholdBudgetForm] = useState<{
    category: HouseholdBudgetCategory;
    monthlyAmount: string;
  }>({
    category: "VEGETABLES",
    monthlyAmount: ""
  });
  const [householdExpenseForm, setHouseholdExpenseForm] = useState<{
    category: HouseholdBudgetCategory;
    amount: string;
  }>({
    category: "VEGETABLES",
    amount: ""
  });
  const [recurringForm, setRecurringForm] = useState<{
    description: string;
    amount: string;
    type: ExpenseType;
  }>({
    description: "",
    amount: "",
    type: "FIXED"
  });
  const [recurringSearch, setRecurringSearch] = useState("");
  const [pendingForm, setPendingForm] = useState({ description: "" });
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

  const isAdmin = session?.role === "ADMIN";
  const isDebtor = session?.role === "DEBTOR";
  const availableTabs = isDebtor ? DEBTOR_TABS : ADMIN_TABS;

  useEffect(() => {
    api.setAuthToken(session?.accessToken ?? null);
    if (typeof window === "undefined") return;
    if (session) {
      window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    } else {
      window.localStorage.removeItem(SESSION_STORAGE_KEY);
    }
  }, [session]);

  useEffect(() => {
    if (!session) {
      setBootLoading(false);
      return;
    }
    if (session.mustChangePassword) {
      setBootLoading(false);
      return;
    }
    void loadInitialData(session);
  }, [session]);

  useEffect(() => {
    const isAllowed =
      availableTabs.some((tab) => tab.key === activeTab) || (isAdmin && activeTab === "debts");
    if (!isAllowed) {
      setActiveTab(availableTabs[0].key);
    }
  }, [activeTab, availableTabs, isAdmin]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", themeMode);
    document.documentElement.setAttribute("data-theme-palette", themeKey);
    window.localStorage.setItem(THEME_STORAGE_KEY, themeKey);
  }, [themeKey, themeMode]);

  useEffect(() => {
    if (!session || session.mustChangePassword) {
      setFabMenuOpen(false);
    }
  }, [session]);

  async function loadInitialData(currentSession: LoginResponse) {
    setBootLoading(true);
    try {
      if (currentSession.role === "ADMIN") {
        // Vercel rule async-parallel: fetch independent resources concurrently.
        const [
          debtorsResponse,
          pendingsResponse,
          fixedList,
          optionalList,
          fixedTotal,
          optionalTotal,
          monthlyFreeAmount,
          householdBudgetSummary
        ] = await Promise.all([
          api.listDebtors(),
          api.listPendings(),
          api.listRecurringExpenses("FIXED"),
          api.listRecurringExpenses("OPTIONAL"),
          api.getRecurringExpenseTotal("FIXED"),
          api.getRecurringExpenseTotal("OPTIONAL"),
          api.getMonthlyFreeAmount(getCurrentYear()),
          api.getHouseholdBudgetSummary()
        ]);

        setDebtors(debtorsResponse.debtors);
        setPendings(pendingsResponse.pendings);
        setRecurringExpenses({
          FIXED: fixedList.recurringExpenses,
          OPTIONAL: optionalList.recurringExpenses
        });
        setRecurringTotals({
          FIXED: fixedTotal.total,
          OPTIONAL: optionalTotal.total
        });
        setMonthlyFreeAmountResult(monthlyFreeAmount);
        setHouseholdBudgetResult(householdBudgetSummary);

        setDebtForm((current) => ({
          ...current,
          debtorId: current.debtorId || debtorsResponse.debtors[0]?.id || ""
        }));
        setDebtorMonthlyQuery((current) => ({
          ...current,
          debtorId: current.debtorId || debtorsResponse.debtors[0]?.id || ""
        }));
      } else {
        const debtorId = currentSession.debtorId ?? "";
        if (!debtorId) {
          throw new Error("La sesión de deudor no tiene debtorId.");
        }
        setDebtors([
          {
            id: debtorId,
            name: currentSession.email,
            email: currentSession.email,
            totalDebt: "0",
            accessEnabled: true
          }
        ]);
        setDebtorMonthlyQuery((current) => ({
          ...current,
          debtorId
        }));
        await loadDebtorMonthData(debtorId, getCurrentYear(), getCurrentMonth());
      }
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 401) {
        setNotice({ type: "error", text: "Sesión expirada. Inicia sesión nuevamente." });
        setSession(null);
      } else {
        setNotice({ type: "error", text: toErrorMessage(error) });
      }
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

  async function reloadPendings() {
    const response = await api.listPendings();
    setPendings(response.pendings);
  }

  async function handleLogin(event: React.FormEvent) {
    event.preventDefault();
    setNotice(null);
    setLoginLoading(true);
    try {
      const result = await api.login({
        email: normalizeEmail(loginForm.email),
        password: loginForm.password
      });
      setSession(result);
      setLoginForm({ email: "", password: "" });
      setActiveTab(result.role === "ADMIN" ? "debtors" : "debtorProfile");
    } catch (error) {
      setNotice({ type: "error", text: toErrorMessage(error) });
    } finally {
      setLoginLoading(false);
    }
  }

  async function handleLogout() {
    setNotice(null);
    try {
      await api.logout();
    } catch {
      // Logout should continue locally even if remote request fails.
    } finally {
      setSession(null);
      setDebtors([]);
      setPendings([]);
      setRecurringExpenses(EMPTY_RECURRING);
      setRecurringTotals(EMPTY_TOTALS);
      setUnpaidByMonthResult(null);
      setSalarySnapshot(null);
      setSalaryPreviewAmount("0");
      setMonthlyFreeAmountResult(null);
      setDebtDetailModal(null);
      setDebtDetail(null);
      setPendingDebtorAccessAction(null);
      setDebtorAccessResult(null);
      setDebtorAccessPassword("");
      setPasswordChangeForm({ newPassword: "", confirmPassword: "" });
      setNotice({ type: "success", text: "Sesión cerrada." });
    }
  }

  async function handleChangeOwnPassword(event: React.FormEvent) {
    event.preventDefault();
    setNotice(null);

    const newPassword = passwordChangeForm.newPassword.trim();
    const confirmPassword = passwordChangeForm.confirmPassword.trim();
    if (newPassword.length < 6) {
      setNotice({ type: "error", text: "La nueva contraseña debe tener al menos 6 caracteres." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setNotice({ type: "error", text: "La confirmación de contraseña no coincide." });
      return;
    }

    setPasswordChangeLoading(true);
    try {
      await api.changePassword({ newPassword });
      setSession((current) => (current ? { ...current, mustChangePassword: false } : current));
      setPasswordChangeForm({ newPassword: "", confirmPassword: "" });
      setNotice({ type: "success", text: "Contraseña actualizada. Ya puedes usar el sistema." });
    } catch (error) {
      setNotice({ type: "error", text: toErrorMessage(error) });
    } finally {
      setPasswordChangeLoading(false);
    }
  }

  async function confirmDebtorAccessAction() {
    if (!pendingDebtorAccessAction) return;
    setNotice(null);
    setDebtorAccessResult(null);
    try {
      const payload = debtorAccessPassword.trim() ? { password: debtorAccessPassword.trim() } : undefined;
      const response =
        pendingDebtorAccessAction.action === "grant"
          ? await api.grantDebtorAccess(pendingDebtorAccessAction.debtorId, payload)
          : await api.resetDebtorPassword(pendingDebtorAccessAction.debtorId, payload);
      setDebtorAccessResult(response);
      setDebtorAccessPassword("");
      setPendingDebtorAccessAction(null);
      await reloadDebtors();
      const actionText =
        pendingDebtorAccessAction.action === "grant"
          ? "Acceso de deudor otorgado."
          : "Contraseña de deudor actualizada.";
      const passwordText = response.password
        ? ` Clave: ${response.password}${response.passwordGenerated ? " (generada)." : "."}`
        : "";
      setNotice({
        type: "success",
        text: `${actionText}${passwordText}`
      });
    } catch (error) {
      setNotice({ type: "error", text: toErrorMessage(error) });
    }
  }

  async function revokeDebtorAccess(debtorId: string) {
    setNotice(null);
    setDebtorAccessResult(null);
    try {
      const response = await api.revokeDebtorAccess(debtorId);
      setDebtorAccessResult(response);
      await reloadDebtors();
      setNotice({ type: "success", text: "Acceso de deudor revocado." });
    } catch (error) {
      setNotice({ type: "error", text: toErrorMessage(error) });
    }
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
      setCreateDebtorModalOpen(false);
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
      await loadMonthlyFreeAmount();
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
      await loadMonthlyFreeAmount();
      setNotice({ type: "success", text: "Ahorro mensual registrado correctamente." });
    } catch (error) {
      setNotice({ type: "error", text: toErrorMessage(error) });
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
      await loadMonthlyFreeAmount();
      setNotice({ type: "success", text: "Gasto recurrente creado." });
    } catch (error) {
      setNotice({ type: "error", text: toErrorMessage(error) });
    }
  }

  async function handleCreatePending(event: React.FormEvent) {
    event.preventDefault();
    setNotice(null);
    try {
      await api.createPending({
        description: pendingForm.description.trim()
      });
      setPendingForm({ description: "" });
      await reloadPendings();
      setNotice({ type: "success", text: "Pendiente creado." });
    } catch (error) {
      setNotice({ type: "error", text: toErrorMessage(error) });
    }
  }

  async function handleCompletePending(id: string) {
    setNotice(null);
    try {
      await api.deletePending(id);
      await reloadPendings();
      setNotice({ type: "success", text: "Pendiente marcado como listo." });
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
      await loadMonthlyFreeAmount();
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
      await loadMonthlyFreeAmount();
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

  async function loadMonthlyFreeAmount() {
    setMonthlyFreeAmountLoading(true);
    try {
      const result = await api.getMonthlyFreeAmount(getCurrentYear());
      setMonthlyFreeAmountResult(result);
    } finally {
      setMonthlyFreeAmountLoading(false);
    }
  }

  async function loadHouseholdBudgetSummary() {
    setHouseholdBudgetLoading(true);
    try {
      const result = await api.getHouseholdBudgetSummary();
      setHouseholdBudgetResult(result);
    } finally {
      setHouseholdBudgetLoading(false);
    }
  }

  async function handleConfigureHouseholdBudget(event: React.FormEvent) {
    event.preventDefault();
    setNotice(null);
    try {
      await api.configureHouseholdBudget({
        category: householdBudgetForm.category,
        monthlyAmount: parseAmountInput(householdBudgetForm.monthlyAmount)
      });
      await loadHouseholdBudgetSummary();
      setHouseholdBudgetForm((current) => ({ ...current, monthlyAmount: "" }));
      setNotice({ type: "success", text: "Presupuesto mensual actualizado." });
    } catch (error) {
      setNotice({ type: "error", text: toErrorMessage(error) });
    }
  }

  async function handleRegisterHouseholdExpense(event: React.FormEvent) {
    event.preventDefault();
    setNotice(null);
    try {
      const amount = parseSignedAmountInput(householdExpenseForm.amount);
      if (amount === 0) {
        throw new Error("Ingresa un monto distinto de cero.");
      }
      await api.registerHouseholdExpense({
        category: householdExpenseForm.category,
        amount
      });
      await loadHouseholdBudgetSummary();
      setHouseholdExpenseForm((current) => ({ ...current, amount: "" }));
      setNotice({ type: "success", text: "Movimiento registrado." });
    } catch (error) {
      setNotice({ type: "error", text: toErrorMessage(error) });
    }
  }

  async function handleResetHouseholdBudget(category: HouseholdBudgetCategory) {
    setNotice(null);
    try {
      await api.resetHouseholdBudget(category);
      await loadHouseholdBudgetSummary();
      setNotice({ type: "success", text: `${getHouseholdCategoryLabel(category)} reiniciado al monto original.` });
    } catch (error) {
      setNotice({ type: "error", text: toErrorMessage(error) });
    }
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

  async function executePayInstallment(installmentId: string) {
    if (!isAdmin) return;
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

  async function handleUpdateDebt() {
    setNotice(null);
    if (!debtEditModal) return;

    const installmentAmount = parseAmountInput(debtEditModal.debt.installments[0]?.amount?.toString() || "0");
    const createdAt = debtEditModal.debt.createdAt;

    const payload: UpdateDebtRequest = {
      description: debtEditModal.debt.description,
      totalAmount: parseAmountInput(debtEditModal.debt.totalAmount.toString()),
      installmentAmount,
      createdAt
    };

    try {
      await api.updateDebt(debtEditModal.debt.id, payload);
      setNotice({ type: "success", text: "Deuda actualizada correctamente." });
      setDebtEditModal(null);
      setDebtEditConfirmModal(null);

      if (debtDetailModal) {
        await loadDebtDetail(debtDetailModal);
      }
      await reloadDebtors();
    } catch (error) {
      setNotice({ type: "error", text: toErrorMessage(error) });
    }
  }

  async function confirmUpdateDebt() {
    if (!debtEditConfirmModal) return;
    if (!debtEditModal) {
      setDebtEditConfirmModal(null);
      return;
    }

    const installmentAmount = parseAmountInput(debtEditConfirmModal.debt.installments[0]?.amount?.toString() || "0");
    const createdAt = debtEditConfirmModal.debt.createdAt?.slice(0, 10) || "";

    const payload: UpdateDebtRequest = {
      description: debtEditConfirmModal.debt.description,
      totalAmount: parseAmountInput(debtEditConfirmModal.debt.totalAmount.toString()),
      installmentAmount,
      createdAt
    };

    try {
      await api.updateDebt(debtEditConfirmModal.debt.id, payload);
      setNotice({ type: "success", text: "Deuda actualizada correctamente." });
      setDebtEditModal(null);
      setDebtEditConfirmModal(null);

      if (debtDetailModal) {
        await loadDebtDetail(debtDetailModal);
      }
      await reloadDebtors();
    } catch (error) {
      setNotice({ type: "error", text: toErrorMessage(error) });
    }
  }

  function requestPayInstallment(installmentId: string, amount: string | number, dueDate: string | null) {
    if (!isAdmin) return;
    setPendingInstallmentPayment({
      installmentId,
      amount: String(amount),
      dueDate
    });
  }

  async function confirmPayInstallment() {
    if (!pendingInstallmentPayment) return;
    const target = pendingInstallmentPayment;
    setPendingInstallmentPayment(null);
    await executePayInstallment(target.installmentId);
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
      setSalarySnapshotLoading(true);
      try {
        const preview = await api.getSalaryPreview({ debtorId, year, month });
        setSalaryPreviewAmount(preview.salaryPreviewAmount);
        setSalarySnapshot(preview.snapshot);
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

  async function executePayMonthlySalary() {
    if (!isAdmin) return;
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

  function requestPayMonthlySalary() {
    if (!debtorMonthlyQuery.debtorId) return;
    const selectedDebtor = debtors.find((debtor) => debtor.id === debtorMonthlyQuery.debtorId);
    const debtorName = selectedDebtor?.name ?? unpaidByMonthResult?.debtorName ?? debtorMonthlyQuery.debtorId;
    if (!isAdmin) return;
    setPendingSalaryPayment({
      debtorName,
      year: debtorMonthlyQuery.year,
      month: debtorMonthlyQuery.month,
      amount: formatCurrency(salarySnapshot?.salaryColumnAmount ?? salaryPreviewAmount)
    });
  }

  async function confirmPayMonthlySalary() {
    if (!pendingSalaryPayment) return;
    setPendingSalaryPayment(null);
    await executePayMonthlySalary();
  }

  async function handleDownloadMonthlyPdf() {
    if (!debtorMonthlyQuery.debtorId) return;
    setNotice(null);
    try {
      const summary = await api.getMonthlySummaryReport({
        debtorId: debtorMonthlyQuery.debtorId,
        year: debtorMonthlyQuery.year,
        month: debtorMonthlyQuery.month
      });
      const pdfBlob = await generateMonthlySummaryPdfBlob(summary);
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
    if (!isAdmin) return;
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
    if (!isAdmin) return;
    if (!debtorMonthlyQuery.debtorId) return;
    const selectedDebtor =
      debtors.find((debtor) => debtor.id === debtorMonthlyQuery.debtorId) ??
      (unpaidByMonthResult
        ? {
            id: unpaidByMonthResult.debtorId,
            name: unpaidByMonthResult.debtorName,
            email: unpaidByMonthResult.debtorEmail,
            totalDebt: "0",
            accessEnabled: true
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
  const canShowNavigation = Boolean(session && !session.mustChangePassword);

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <div className="header-top">
            <h1>Balance Hub</h1>
            <div className="header-actions">
              {session ? (
                <button type="button" className="secondary logout-btn" onClick={() => void handleLogout()}>
                  <span className="header-action-icon" aria-hidden="true">
                    <MobileMenuIcon name="logout" />
                  </span>
                  Cerrar sesión
                </button>
              ) : null}
            </div>
          </div>
          {session ? (
            <p className="subtitle">
              Sesión: <strong>{session.email}</strong> ({session.role === "ADMIN" ? "Administrador" : "Deudor"})
            </p>
          ) : null}
        </div>
      </header>

      {!canShowNavigation ? null : (
        <nav className="tabs" aria-label="Secciones">
          {availableTabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={tab.key === activeTab ? `tab tab-${tab.key} active` : `tab tab-${tab.key}`}
              onClick={() => setActiveTab(tab.key)}
            >
              <span className="tab-icon" aria-hidden="true">
                <MobileMenuIcon name={tab.key} />
              </span>
              {tab.label}
            </button>
          ))}
        </nav>
      )}

      {canShowNavigation ? (
        <>
          <div
            className={fabMenuOpen ? "fab-backdrop open" : "fab-backdrop"}
            role="presentation"
            onClick={() => setFabMenuOpen(false)}
          />
          <div className="fab-menu-wrapper">
            <div className={fabMenuOpen ? "fab-actions open" : "fab-actions"} role="menu" aria-label="Menú rápido">
              {availableTabs.map((tab) => (
                <button
                  key={`fab-${tab.key}`}
                  type="button"
                  className={tab.key === activeTab ? `fab-action fab-action-${tab.key} active` : `fab-action fab-action-${tab.key}`}
                  onClick={() => {
                    setActiveTab(tab.key);
                    setFabMenuOpen(false);
                  }}
                >
                  <span className="fab-action-icon" aria-hidden="true">
                    <MobileMenuIcon name={tab.key} />
                  </span>
                  {tab.label}
                </button>
              ))}
              <button
                type="button"
                className="fab-action fab-action-logout danger"
                onClick={() => {
                  setFabMenuOpen(false);
                  void handleLogout();
                }}
              >
                <span className="fab-action-icon" aria-hidden="true">
                  <MobileMenuIcon name="logout" />
                </span>
                Cerrar sesión
              </button>
            </div>
            <button
              type="button"
              className={fabMenuOpen ? "fab-main open" : "fab-main"}
              aria-label={fabMenuOpen ? "Cerrar menú rápido" : "Abrir menú rápido"}
              aria-expanded={fabMenuOpen}
              onClick={() => setFabMenuOpen((current) => !current)}
            >
              {fabMenuOpen ? "×" : "+"}
            </button>
          </div>
        </>
      ) : null}

      {notice ? (
        <div className={notice.type === "error" ? "notice error" : "notice success"} role="status">
          {notice.text}
        </div>
      ) : null}

      {!session ? (
        <main className="grid">
          <section className="panel auth-panel">
            <div className="panel-header">
              <h2>Iniciar sesión</h2>
              <p>Accede con tu usuario y contraseña para entrar al sistema.</p>
            </div>
            <form className="form-grid auth-form" onSubmit={handleLogin}>
              <label>
                Usuario o email
                <input
                  value={loginForm.email}
                  onChange={(event) => setLoginForm((current) => ({ ...current, email: event.target.value }))}
                  placeholder="Usuario"
                  autoComplete="username"
                  required
                />
              </label>
              <label>
                Contraseña
                <input
                  type="password"
                  value={loginForm.password}
                  onChange={(event) => setLoginForm((current) => ({ ...current, password: event.target.value }))}
                  autoComplete="current-password"
                  required
                />
              </label>
              <div className="form-actions">
                <button type="submit" disabled={loginLoading}>
                  {loginLoading ? "Ingresando..." : "Ingresar"}
                </button>
              </div>
            </form>
          </section>
        </main>
      ) : null}

      {session?.mustChangePassword ? (
        <main className="grid">
          <section className="panel auth-panel">
            <div className="panel-header">
              <h2>Cambio de contraseña obligatorio</h2>
              <p>Por seguridad, debes crear una nueva contraseña antes de continuar.</p>
            </div>
            <form className="form-grid auth-form" onSubmit={handleChangeOwnPassword}>
              <label>
                Nueva contraseña
                <input
                  type="password"
                  value={passwordChangeForm.newPassword}
                  onChange={(event) =>
                    setPasswordChangeForm((current) => ({ ...current, newPassword: event.target.value }))
                  }
                  autoComplete="new-password"
                  required
                />
              </label>
              <label>
                Confirmar contraseña
                <input
                  type="password"
                  value={passwordChangeForm.confirmPassword}
                  onChange={(event) =>
                    setPasswordChangeForm((current) => ({ ...current, confirmPassword: event.target.value }))
                  }
                  autoComplete="new-password"
                  required
                />
              </label>
              <div className="form-actions">
                <button type="submit" disabled={passwordChangeLoading}>
                  {passwordChangeLoading ? "Actualizando..." : "Cambiar contraseña"}
                </button>
              </div>
            </form>
          </section>
        </main>
      ) : null}

      {pendingDebtorAccessAction ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setPendingDebtorAccessAction(null)}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="debtor-access-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 id="debtor-access-title">
              {pendingDebtorAccessAction.action === "grant" ? "Otorgar acceso" : "Reiniciar contraseña"}
            </h3>
            <p>
              Deudor: <strong>{pendingDebtorAccessAction.debtorName}</strong>
            </p>
            <div className="form-grid" style={{ marginBottom: 0 }}>
              <label>
                Contraseña (opcional)
                <input
                  value={debtorAccessPassword}
                  onChange={(event) => setDebtorAccessPassword(event.target.value)}
                  placeholder="Vacío = generar automáticamente"
                />
              </label>
            </div>
            <div className="form-actions split" style={{ marginTop: "0.8rem" }}>
              <button type="button" onClick={() => void confirmDebtorAccessAction()}>
                Confirmar
              </button>
              <button type="button" className="secondary" onClick={() => setPendingDebtorAccessAction(null)}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {createDebtorModalOpen ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setCreateDebtorModalOpen(false)}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-debtor-title"
            onClick={(event) => event.stopPropagation()}
          >
            <form className="form-grid" onSubmit={handleCreateDebtor}>
              <h3 id="create-debtor-title">Crear deudor</h3>
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
              <div className="form-actions split">
                <button type="submit">Guardar</button>
                <button type="button" className="secondary" onClick={() => setCreateDebtorModalOpen(false)}>
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {!session ? null : recurringEditing ? (
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

      {pendingInstallmentPayment ? (
        <div
          className="modal-backdrop modal-front"
          role="presentation"
          onClick={() => setPendingInstallmentPayment(null)}
        >
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pay-installment-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 id="pay-installment-title">Confirmar pago de cuota</h3>
            <p>
              Monto: <strong>{formatCurrency(pendingInstallmentPayment.amount)}</strong>
            </p>
            <p>Vencimiento: {formatDate(pendingInstallmentPayment.dueDate)}</p>
            <div className="form-actions split">
              <button type="button" className="pay-btn" onClick={() => void confirmPayInstallment()}>
                ✓ Pagar cuota
              </button>
              <button type="button" className="secondary" onClick={() => setPendingInstallmentPayment(null)}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {pendingSalaryPayment ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setPendingSalaryPayment(null)}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pay-salary-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 id="pay-salary-title">Confirmar pago de sueldo</h3>
            <p>
              Deudor: <strong>{pendingSalaryPayment.debtorName}</strong>
            </p>
            <p>
              Periodo: {getMonthLabel(pendingSalaryPayment.month)} {pendingSalaryPayment.year}
            </p>
            <p>
              Monto: <strong>{pendingSalaryPayment.amount}</strong>
            </p>
            <div className="form-actions split">
              <button type="button" className="salary-pay-btn" onClick={() => void confirmPayMonthlySalary()}>
                ✓ Pagar sueldo
              </button>
              <button type="button" className="secondary" onClick={() => setPendingSalaryPayment(null)}>
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
                      {isAdmin && !debtDetail.settled ? (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setDebtEditModal({
                                debt: {
                                  ...debtDetail,
                                  totalAmount: formatAmountInput(String(debtDetail.totalAmount)),
                                  installments: debtDetail.installments.map((inst) => ({
                                    ...inst,
                                    amount: formatAmountInput(String(inst.amount))
                                  }))
                                },
                                debtorId: debtDetailModal.debtorId,
                                debtorName: debtDetailModal.debtorName,
                                debtorEmail: debtDetailModal.debtorEmail
                              });
                            }}
                          >
                            Editar deuda
                          </button>
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
                        </>
                      ) : null}
                    </div>
                  </div>
                  <p className="muted">
                    Creada: {formatDate(debtDetail.createdAt)} | ID: <span className="mono">{debtDetail.id}</span>
                  </p>

                  <div className="table-wrap">
                    <table className="card-table">
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
                            <td data-label="#"> {installment.number}</td>
                            <td data-label="Vence">{formatDate(installment.dueDate)}</td>
                            <td data-label="Monto">{formatCurrency(installment.amount)}</td>
                            <td data-label="Pagada">
                              {installment.paidAt ? formatDateTime(installment.paidAt) : "No"}
                            </td>
                            <td data-label="Acción">
                              {installment.paidAt || !isAdmin ? (
                                <span className="muted">Sin acción</span>
                              ) : (
                                <button
                                  type="button"
                                  className="pay-btn"
                                  onClick={() =>
                                    requestPayInstallment(installment.id, installment.amount, installment.dueDate)
                                  }
                                >
                                  ✓ Pagar ahora
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

      {debtEditModal ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setDebtEditModal(null)}>
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="edit-debt-title" onClick={(e) => e.stopPropagation()}>
            <form className="form-grid" onSubmit={(e) => { e.preventDefault(); setDebtEditConfirmModal({ debt: { ...debtEditModal.debt }, debtorId: debtEditModal.debtorId, debtorName: debtEditModal.debtorName, debtorEmail: debtEditModal.debtorEmail }); }}>
              <h3 id="edit-debt-title">Editar Deuda</h3>
              <label>
                Descripcion
                <input
                  type="text"
                  value={debtEditModal.debt.description}
                  onChange={(e) => setDebtEditModal({ ...debtEditModal, debt: { ...debtEditModal.debt, description: e.target.value } })}
                  required
                />
              </label>
              <label>
                Monto Total
                <input
                  type="text"
                  inputMode="numeric"
                  value={debtEditModal.debt.totalAmount}
                  onChange={(e) => setDebtEditModal({ ...debtEditModal, debt: { ...debtEditModal.debt, totalAmount: formatAmountInput(e.target.value) } })}
                  required
                />
              </label>
              <label>
                Monto Cuota
                <input
                  type="text"
                  inputMode="numeric"
                  value={debtEditModal.debt.installments[0]?.amount || "0"}
                  onChange={(e) => { const v = formatAmountInput(e.target.value); setDebtEditModal({ ...debtEditModal, debt: { ...debtEditModal.debt, installments: debtEditModal.debt.installments.map((inst) => ({ ...inst, amount: v })) } }); }}
                  required
                />
              </label>
              <label>
                Fecha Creacion
                <input
                  type="date"
                  value={debtEditModal.debt.createdAt ? debtEditModal.debt.createdAt.slice(0, 10) : ""}
                  onChange={(e) => { const v = e.target.value; setDebtEditModal({ ...debtEditModal, debt: { ...debtEditModal.debt, createdAt: v } }); }}
                  required
                />
              </label>
              <div className="form-actions split">
                <button type="submit">Guardar</button>
                <button type="button" className="secondary" onClick={() => setDebtEditModal(null)}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {debtEditConfirmModal ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setDebtEditConfirmModal(null)}>
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="confirm-edit-debt-title" onClick={(e) => e.stopPropagation()}>
            <h3 id="confirm-edit-debt-title">Confirmar Cambios</h3>
            <div className="confirm-changes">
              <p><strong>Descripcion:</strong> {debtEditConfirmModal.debt.description}</p>
              <p><strong>Monto Total:</strong> {formatCurrency(parseAmountInput(String(debtEditConfirmModal.debt.totalAmount)))}</p>
              <p><strong>Monto Cuota:</strong> {formatCurrency(parseAmountInput(String(debtEditConfirmModal.debt.installments[0]?.amount || 0)))}</p>
              <p><strong>Fecha Creacion:</strong> {formatDate(debtEditConfirmModal.debt.createdAt)}</p>
            </div>
            <div className="form-actions split">
              <button type="button" onClick={() => confirmUpdateDebt()}>Confirmar</button>
              <button type="button" className="secondary" onClick={() => setDebtEditConfirmModal(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      ) : null}

      {bootLoading ? <div className="panel">Cargando datos iniciales...</div> : null}

      {!bootLoading && session && !session.mustChangePassword && (
        <main className="grid">
          {activeTab === "debtors" && (
            <Section title="Deudores" description="Crea y visualiza deudores disponibles para asociar deudas.">
              <div className="form-actions" style={{ marginBottom: "0.8rem" }}>
                <button type="button" onClick={() => setCreateDebtorModalOpen(true)}>
                  Nuevo deudor
                </button>
              </div>

              {debtorAccessResult ? (
                <div className="info-card">
                  <p>
                    <strong>Acceso:</strong> {debtorAccessResult.enabled ? "Habilitado" : "Revocado"}
                  </p>
                  <p>
                    <strong>Email:</strong> {debtorAccessResult.email}
                  </p>
                  {debtorAccessResult.password ? (
                    <p>
                      <strong>Contraseña:</strong> {debtorAccessResult.password}{" "}
                      {debtorAccessResult.passwordGenerated ? "(generada)" : "(manual)"}
                    </p>
                  ) : null}
                </div>
              ) : null}

              <div className="table-wrap">
                <table className="card-table">
                  <thead>
                    <tr>
                      <th>Nombre</th>
                      <th>Email</th>
                      <th>Deuda pendiente</th>
                      <th>Inicio sesión</th>
                      <th>Acceso</th>
                    </tr>
                  </thead>
                  <tbody>
                    {debtors.length === 0 ? (
                      <tr>
                        <td className="table-empty" colSpan={5}>
                          No hay deudores registrados.
                        </td>
                      </tr>
                    ) : (
                      debtors.map((debtor) => (
                        <tr key={debtor.id}>
                          <td data-label="Nombre">
                            <button
                              type="button"
                              className="link-btn"
                              onClick={() => openDebtorProfile(debtor.id)}
                            >
                              {debtor.name}
                            </button>
                          </td>
                          <td data-label="Email">{debtor.email}</td>
                          <td data-label="Deuda pendiente">{formatCurrency(debtor.totalDebt)}</td>
                          <td data-label="Inicio sesión">
                            <span className={debtor.accessEnabled ? "badge success" : "badge warning"}>
                              {debtor.accessEnabled ? "Habilitado" : "Revocado"}
                            </span>
                          </td>
                          <td data-label="Acceso">
                            <div className="item-actions">
                              <button
                                type="button"
                                className="icon-btn secondary"
                                aria-label={`Otorgar acceso a ${debtor.name}`}
                                title="Otorgar acceso"
                                onClick={() =>
                                  setPendingDebtorAccessAction({
                                    debtorId: debtor.id,
                                    debtorName: debtor.name,
                                    action: "grant"
                                  })
                                }
                              >
                                ✓
                              </button>
                              <button
                                type="button"
                                className="icon-btn secondary"
                                aria-label={`Cambiar clave de ${debtor.name}`}
                                title="Cambiar clave"
                                onClick={() =>
                                  setPendingDebtorAccessAction({
                                    debtorId: debtor.id,
                                    debtorName: debtor.name,
                                    action: "resetPassword"
                                  })
                                }
                              >
                                🔑
                              </button>
                              <button
                                type="button"
                                className="icon-btn danger"
                                aria-label={`Revocar acceso de ${debtor.name}`}
                                title="Revocar acceso"
                                onClick={() => void revokeDebtorAccess(debtor.id)}
                              >
                                ×
                              </button>
                            </div>
                          </td>
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
                  {isAdmin ? (
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
                  ) : (
                    <label>
                      Deudor
                      <input value={session?.email ?? "-"} readOnly />
                    </label>
                  )}
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
                  {isAdmin ? (
                    <div className="form-actions">
                      <button type="button" className="secondary" onClick={openDebtsFromDebtorProfile}>
                        Crear deuda
                      </button>
                    </div>
                  ) : null}
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
                    {salarySnapshot
                      ? salarySnapshot.status === "PAID"
                        ? salarySnapshot.paidAt
                          ? ` (Pagado ${formatDateTime(salarySnapshot.paidAt)})`
                          : " (Pagado)"
                        : " (Pendiente)"
                      : " (preview)"}
                  </p>
                  <p className="muted">
                    Resultado para {getMonthLabel(debtorMonthlyQuery.month)} {debtorMonthlyQuery.year}
                  </p>
                  <div className="form-actions split" style={{ marginTop: "0.6rem" }}>
                    {isAdmin ? (
                      <button
                        type="button"
                        className="salary-pay-btn"
                        onClick={requestPayMonthlySalary}
                        disabled={salaryPaying || salarySnapshotLoading}
                      >
                        {salaryPaying ? "Pagando..." : "✓ Pagar sueldo"}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="pdf-btn"
                      onClick={() => void handleDownloadMonthlyPdf()}
                      disabled={!debtorMonthlyQuery.debtorId || unpaidByMonthLoading}
                    >
                      Descargar PDF
                    </button>
                  </div>
                </div>

                {unpaidByMonthLoading ? <p className="muted">Consultando cuotas impagas...</p> : null}

                <div className="table-wrap">
                  <table className="card-table">
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
                          <td className="table-empty" colSpan={7}>
                            No hay cuotas para este filtro.
                          </td>
                        </tr>
                      ) : (
                        unpaidByMonthResult.installments.map((item) => (
                          <tr key={item.installmentId}>
                            <td data-label="Vencimiento">{formatDate(item.dueDate)}</td>
                            <td data-label="Monto">{formatCurrency(item.amount)}</td>
                            <td data-label="Estado">
                              <span className={item.paid ? "badge success" : "badge warning"}>
                                {item.paid ? "Pagada" : "Pendiente"}
                              </span>
                            </td>
                            <td data-label="Pertenece a">
                              <button
                                type="button"
                                className="link-btn"
                                onClick={() => openDebtDetailFromInstallment(item)}
                              >
                                {item.debtDescription}
                              </button>
                            </td>
                            <td data-label="Cuota">
                              {item.installmentNumber}/{item.totalInstallments}
                            </td>
                            <td data-label="Sueldo">{formatCurrency(salarySnapshot?.salaryColumnAmount ?? salaryPreviewAmount)}</td>
                            <td data-label="Acción">
                              {item.paid || !isAdmin || !salarySnapshot || salarySnapshot.status !== "PAID" ? (
                                <span className="muted">Sin acción</span>
                              ) : (
                                <button
                                  type="button"
                                  className="pay-btn"
                                  onClick={() => requestPayInstallment(item.installmentId, item.amount, item.dueDate)}
                                >
                                  ✓ Pagar
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
                <h3>Monto libre mensual</h3>
                {monthlyFreeAmountLoading ? <p className="muted">Calculando...</p> : null}
                {!monthlyFreeAmountLoading && monthlyFreeAmountResult ? (
                  <div className="summary-row salary-summary-row">
                    <div className="stat">
                      <span>Sueldo actual</span>
                      <strong>{formatCurrency(monthlyFreeAmountResult.currentSalary)}</strong>
                    </div>
                    <div className="stat">
                      <span>Ahorro mensual</span>
                      <strong>{formatCurrency(monthlyFreeAmountResult.monthlySavingsGoal)}</strong>
                    </div>
                    <div className="stat">
                      <span>Gastos fijos</span>
                      <strong>{formatCurrency(monthlyFreeAmountResult.monthlyFixedExpenses)}</strong>
                    </div>
                    <div className="stat">
                      <span>Gastos opcionales</span>
                      <strong>{formatCurrency(monthlyFreeAmountResult.monthlyOptionalExpenses)}</strong>
                    </div>
                    <div className="stat total">
                      <span>Monto libre</span>
                      <strong>{formatCurrency(monthlyFreeAmountResult.monthlyFreeAmount)}</strong>
                    </div>
                  </div>
                ) : null}
              </div>

            </Section>
          )}

          {activeTab === "household" && (
            <Section
              title="Verduras y mercadería"
              description="Define monto original por categoría, descuenta gastos y reinicia cuando quieras al monto original."
            >
              <div className="household-subtabs" role="tablist" aria-label="Opciones de verduras y mercadería">
                <button
                  type="button"
                  role="tab"
                  aria-selected={householdSubTab === "spend"}
                  className={householdSubTab === "spend" ? "household-subtab active" : "household-subtab"}
                  onClick={() => setHouseholdSubTab("spend")}
                >
                  Resumen y gasto
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={householdSubTab === "settings"}
                  className={householdSubTab === "settings" ? "household-subtab active" : "household-subtab"}
                  onClick={() => setHouseholdSubTab("settings")}
                >
                  Configuración
                </button>
              </div>

              {householdBudgetLoading ? <p className="muted">Actualizando resumen...</p> : null}

              {householdSubTab === "spend" ? (
                <>
                  <div className="summary-row household-summary-row">
                    {(householdBudgetResult?.budgets ?? []).map((item) => (
                      <div
                        className={`stat household-balance-card ${
                          item.category === "VEGETABLES" ? "household-balance-vegetables" : "household-balance-groceries"
                        }`}
                        key={item.category}
                      >
                        <span className="household-category-label">
                          <span className="household-category-icon" aria-hidden="true">
                            {getHouseholdCategoryIcon(item.category)}
                          </span>
                          {getHouseholdCategoryLabel(item.category)}
                        </span>
                        <strong>{formatCurrency(item.remainingAmount)}</strong>
                        <p className="muted">
                          Presupuesto: {formatCurrency(item.monthlyAmount)} | Gastado: {formatCurrency(item.spentAmount)}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div
                    className={`subpanel household-primary household-form-panel ${
                      householdExpenseForm.category === "VEGETABLES"
                        ? "household-form-panel-vegetables"
                        : "household-form-panel-groceries"
                    }`}
                  >
                    <h3>Registrar gasto</h3>
                    <form className="form-grid compact" onSubmit={handleRegisterHouseholdExpense}>
                      <label>
                        Categoría
                        <select
                          value={householdExpenseForm.category}
                          onChange={(event) =>
                            setHouseholdExpenseForm((current) => ({
                              ...current,
                              category: event.target.value as HouseholdBudgetCategory
                            }))
                          }
                        >
                          <option value="VEGETABLES">🥦 Verduras</option>
                          <option value="GROCERIES">🛒 Mercadería</option>
                        </select>
                      </label>
                      <label>
                        Monto gastado
                        <input
                          type="text"
                          inputMode="numeric"
                          value={householdExpenseForm.amount}
                          onChange={(event) =>
                            setHouseholdExpenseForm((current) => ({
                              ...current,
                              amount: formatSignedAmountInput(event.target.value)
                            }))
                          }
                          placeholder="10000 o -10000"
                          required
                        />
                      </label>
                      <div className="form-actions">
                        <button type="submit">Descontar gasto</button>
                      </div>
                    </form>
                  </div>
                </>
              ) : (
                <div className="household-settings-grid">
                  <div
                    className={`subpanel household-config-panel household-form-panel ${
                      householdBudgetForm.category === "VEGETABLES"
                        ? "household-form-panel-vegetables"
                        : "household-form-panel-groceries"
                    }`}
                  >
                    <h3>Configurar monto mensual</h3>
                    <form className="form-grid compact" onSubmit={handleConfigureHouseholdBudget}>
                      <label>
                        Categoría
                        <select
                          value={householdBudgetForm.category}
                          onChange={(event) =>
                            setHouseholdBudgetForm((current) => ({
                              ...current,
                              category: event.target.value as HouseholdBudgetCategory
                            }))
                          }
                        >
                          <option value="VEGETABLES">🥦 Verduras</option>
                          <option value="GROCERIES">🛒 Mercadería</option>
                        </select>
                      </label>
                      <label>
                        Monto mensual
                        <input
                          type="text"
                          inputMode="numeric"
                          value={householdBudgetForm.monthlyAmount}
                          onChange={(event) =>
                            setHouseholdBudgetForm((current) => ({
                              ...current,
                              monthlyAmount: formatAmountInput(event.target.value)
                            }))
                          }
                          placeholder="120000"
                          required
                        />
                      </label>
                      <div className="form-actions">
                        <button type="submit">Guardar presupuesto</button>
                      </div>
                    </form>
                  </div>

                  <div className="subpanel household-reset-panel">
                    <h3>Reset de saldos</h3>
                    <ul className="list">
                      {(householdBudgetResult?.budgets ?? []).map((item) => (
                        <li
                          className={`list-item household-reset-item ${
                            item.category === "VEGETABLES" ? "household-reset-vegetables" : "household-reset-groceries"
                          }`}
                          key={`reset-${item.category}`}
                        >
                          <div>
                            <p className="list-title household-category-label">
                              <span className="household-category-icon" aria-hidden="true">
                                {getHouseholdCategoryIcon(item.category)}
                              </span>
                              {getHouseholdCategoryLabel(item.category)}
                            </p>
                            <p className="muted">
                              Actual: {formatCurrency(item.remainingAmount)} | Original: {formatCurrency(item.monthlyAmount)}
                            </p>
                          </div>
                          <button
                            type="button"
                            className="secondary"
                            onClick={() => void handleResetHouseholdBudget(item.category)}
                          >
                            Reset
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </Section>
          )}

          {activeTab === "themes" && (
            <Section
              title="Temas"
              description="Elige el estilo visual del sistema. Se guarda automáticamente en tu navegador."
            >
              <div className="theme-groups">
                <div className="theme-group">
                  <h3>Claros</h3>
                  <div className="theme-grid">
                    {THEME_OPTIONS.filter((theme) => theme.base === "light").map((theme) => (
                      <button
                        key={theme.key}
                        type="button"
                        className={themeKey === theme.key ? "theme-card active" : "theme-card"}
                        onClick={() => setThemeKey(theme.key)}
                      >
                        <span className={`theme-swatch theme-swatch-${theme.key}`} aria-hidden="true" />
                        <span className="theme-card-title">{theme.label}</span>
                        <span className="theme-card-mode">Claro</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="theme-group">
                  <h3>Oscuros</h3>
                  <div className="theme-grid">
                    {THEME_OPTIONS.filter((theme) => theme.base === "dark").map((theme) => (
                      <button
                        key={theme.key}
                        type="button"
                        className={themeKey === theme.key ? "theme-card active" : "theme-card"}
                        onClick={() => setThemeKey(theme.key)}
                      >
                        <span className={`theme-swatch theme-swatch-${theme.key}`} aria-hidden="true" />
                        <span className="theme-card-title">{theme.label}</span>
                        <span className="theme-card-mode">Oscuro</span>
                      </button>
                    ))}
                  </div>
                </div>
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

              <div className="search-row">
                <label className="search-field">
                  <span className="search-icon" aria-hidden="true">
                    🔎
                  </span>
                  <input
                    type="text"
                    value={recurringSearch}
                    onChange={(event) => setRecurringSearch(event.target.value)}
                    placeholder="Buscar gasto por descripción o monto"
                  />
                </label>
              </div>

              <div className="two-columns">
                {(["FIXED", "OPTIONAL"] as ExpenseType[]).map((type) => (
                  <div className={`subpanel ${getExpenseTypeClassName(type)}`} key={type}>
                    <div className="subpanel-title">
                      <h3>{getExpenseTypeLabel(type)}</h3>
                    </div>
                    <ul className="list">
                      {recurringExpenses[type].filter((item) => {
                        const query = recurringSearch.trim().toLowerCase();
                        if (!query) return true;
                        return (
                          item.description.toLowerCase().includes(query) ||
                          formatCurrency(item.amount).toLowerCase().includes(query)
                        );
                      }).length === 0 ? (
                        <li className="list-item empty">Sin gastos de este tipo.</li>
                      ) : (
                        recurringExpenses[type]
                          .filter((item) => {
                            const query = recurringSearch.trim().toLowerCase();
                            if (!query) return true;
                            return (
                              item.description.toLowerCase().includes(query) ||
                              formatCurrency(item.amount).toLowerCase().includes(query)
                            );
                          })
                          .map((item) => (
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

          {activeTab === "pendings" && (
            <Section
              title="Pendientes"
              description="Anota cosas por hacer y elimínalas al marcarlas como listas."
            >
              <form className="form-grid" onSubmit={handleCreatePending}>
                <label>
                  Nuevo pendiente
                  <input
                    value={pendingForm.description}
                    onChange={(event) => setPendingForm({ description: event.target.value })}
                    placeholder="Transferir compra del día"
                    required
                  />
                </label>
                <div className="form-actions">
                  <button type="submit">Agregar pendiente</button>
                </div>
              </form>

              <div className="subpanel">
                <div className="subpanel-title">
                  <h3>Lista activa</h3>
                  <span className="muted">{pendings.length} pendientes</span>
                </div>
                <ul className="list">
                  {pendings.length === 0 ? (
                    <li className="list-item empty">No hay pendientes activos.</li>
                  ) : (
                    pendings.map((item) => (
                      <li key={item.id} className="list-item pending-item">
                        <div>
                          <p className="list-title">{item.description}</p>
                          <p className="muted">Creado: {formatDateTime(item.createdAt)}</p>
                        </div>
                        <div className="item-actions">
                          <button
                            type="button"
                            className="secondary"
                            onClick={() => void handleCompletePending(item.id)}
                          >
                            Listo
                          </button>
                        </div>
                      </li>
                    ))
                  )}
                </ul>
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
