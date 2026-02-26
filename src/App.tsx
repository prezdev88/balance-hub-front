import { startTransition, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { api } from "./lib/api";
import type { Debtor, ExpenseType, GetDebtsResponse, RecurringExpense } from "./types";

type TabKey = "overview" | "debtors" | "debts" | "recurring" | "salary";

type AppNotice = {
  type: "success" | "error";
  text: string;
} | null;

type PendingRecurringDelete = {
  id: string;
  description: string;
  type: ExpenseType;
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
  { key: "overview", label: "Resumen" },
  { key: "debtors", label: "Deudores" },
  { key: "debts", label: "Deudas y cuotas" },
  { key: "recurring", label: "Gastos recurrentes" },
  { key: "salary", label: "Sueldos" }
];

const EMPTY_RECURRING: RecurringState = { FIXED: [], OPTIONAL: [] };
const EMPTY_TOTALS: RecurringTotals = { FIXED: "0", OPTIONAL: "0" };

function getTodayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function getMonthStartDate(): string {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  return monthStart.toISOString().slice(0, 10);
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

function formatDate(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("es-CL");
}

function getExpenseTypeLabel(type: ExpenseType): string {
  return type === "FIXED" ? "Fijo" : "Opcional";
}

function getExpenseTypeClassName(type: ExpenseType): string {
  return type === "FIXED" ? "expense-fixed" : "expense-optional";
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
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [bootLoading, setBootLoading] = useState(true);
  const [notice, setNotice] = useState<AppNotice>(null);

  const [debtors, setDebtors] = useState<Debtor[]>([]);
  const [recurringExpenses, setRecurringExpenses] = useState<RecurringState>(EMPTY_RECURRING);
  const [recurringTotals, setRecurringTotals] = useState<RecurringTotals>(EMPTY_TOTALS);
  const [debtsResult, setDebtsResult] = useState<GetDebtsResponse | null>(null);
  const [debtsLoading, setDebtsLoading] = useState(false);
  const [pendingRecurringDelete, setPendingRecurringDelete] = useState<PendingRecurringDelete>(null);

  const [debtorForm, setDebtorForm] = useState({ name: "", email: "" });
  const [salaryAmount, setSalaryAmount] = useState("");
  const [salaryLastCreated, setSalaryLastCreated] = useState<{
    id: string;
    amount: string;
    createdAt: string;
  } | null>(null);
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
  const [debtQuery, setDebtQuery] = useState({
    debtorId: "",
    startDate: getMonthStartDate(),
    endDate: getTodayDate()
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
      setDebtQuery((current) => ({
        ...current,
        debtorId: current.debtorId || debtorsResponse.debtors[0]?.id || ""
      }));
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
    setDebtQuery((current) => ({
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
      setNotice({ type: "success", text: "Sueldo registrado correctamente." });
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

      if (debtQuery.debtorId === debtForm.debtorId) {
        startTransition(() => {
          void runDebtQuery();
        });
      }
    } catch (error) {
      setNotice({ type: "error", text: toErrorMessage(error) });
    }
  }

  async function runDebtQuery() {
    if (!debtQuery.debtorId) {
      setNotice({ type: "error", text: "Selecciona un deudor para buscar deudas." });
      return;
    }

    setDebtsLoading(true);
    setNotice(null);
    try {
      const result = await api.getDebtsByRange(debtQuery);
      setDebtsResult(result);
    } catch (error) {
      setDebtsResult(null);
      setNotice({ type: "error", text: toErrorMessage(error) });
    } finally {
      setDebtsLoading(false);
    }
  }

  async function handlePayInstallment(installmentId: string) {
    setNotice(null);
    try {
      await api.payInstallment(installmentId, { paymentDate: new Date().toISOString() });
      setNotice({ type: "success", text: "Cuota marcada como pagada." });
      await reloadDebtors();
      if (debtsResult) {
        startTransition(() => {
          void runDebtQuery();
        });
      }
    } catch (error) {
      setNotice({ type: "error", text: toErrorMessage(error) });
    }
  }

  const totalRecurring = Number(recurringTotals.FIXED || 0) + Number(recurringTotals.OPTIONAL || 0);
  const pendingInstallmentsCount =
    debtsResult?.debts.reduce(
      (total, debt) => total + debt.installments.filter((installment) => !installment.paidAt).length,
      0
    ) ?? 0;

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Balance Hub</p>
          <h1>Panel de Finanzas Personales</h1>
          <p className="subtitle">
            Frontend para tu backend Spring Boot (`/api/debtors`, `/api/debts`, `/api/recurring-expenses`,
            `/api/salaries`, `/api/installments`).
          </p>
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

      {bootLoading ? <div className="panel">Cargando datos iniciales...</div> : null}

      {!bootLoading && (
        <main className="grid">
          {(activeTab === "overview" || activeTab === "debtors") && (
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
                          <td>{debtor.name}</td>
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

          {(activeTab === "overview" || activeTab === "salary") && (
            <Section title="Sueldos" description="Registra un sueldo con el endpoint `/api/salaries`.">
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
                  <button type="submit">Registrar sueldo</button>
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
                  <p className="mono">{salaryLastCreated.id}</p>
                </div>
              ) : (
                <p className="muted">Aún no registras sueldos desde este frontend.</p>
              )}
            </Section>
          )}

          {(activeTab === "overview" || activeTab === "recurring") && (
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

          {(activeTab === "overview" || activeTab === "debts") && (
            <Section
              title="Deudas y Cuotas"
              description="Crear deudas, consultar por rango y marcar cuotas como pagadas."
            >
              <div className="two-columns">
                <div className="subpanel">
                  <h3>Crear deuda</h3>
                  <form className="form-grid" onSubmit={handleCreateDebt}>
                    <label>
                      Deudor
                      <select
                        value={debtForm.debtorId}
                        onChange={(event) => setDebtForm((c) => ({ ...c, debtorId: event.target.value }))}
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
                </div>

                <div className="subpanel">
                  <h3>Buscar deudas por rango</h3>
                  <form
                    className="form-grid"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void runDebtQuery();
                    }}
                  >
                    <label>
                      Deudor
                      <select
                        value={debtQuery.debtorId}
                        onChange={(event) => setDebtQuery((c) => ({ ...c, debtorId: event.target.value }))}
                        required
                      >
                        <option value="" disabled>
                          Selecciona un deudor
                        </option>
                        {debtors.map((debtor) => (
                          <option key={debtor.id} value={debtor.id}>
                            {debtor.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Fecha inicio
                      <input
                        type="date"
                        value={debtQuery.startDate}
                        onChange={(event) => setDebtQuery((c) => ({ ...c, startDate: event.target.value }))}
                        required
                      />
                    </label>
                    <label>
                      Fecha fin
                      <input
                        type="date"
                        value={debtQuery.endDate}
                        onChange={(event) => setDebtQuery((c) => ({ ...c, endDate: event.target.value }))}
                        required
                      />
                    </label>
                    <div className="form-actions split">
                      <button type="submit">Consultar</button>
                      <button type="button" className="secondary" onClick={() => setDebtsResult(null)}>
                        Limpiar
                      </button>
                    </div>
                  </form>

                  <div className="info-card">
                    <p>
                      <strong>Cuotas pendientes encontradas:</strong> {pendingInstallmentsCount}
                    </p>
                  </div>
                </div>
              </div>

              {debtsLoading ? <p className="muted">Consultando deudas...</p> : null}

              {debtsResult ? (
                <div className="debts-result">
                  <div className="result-header">
                    <h3>
                      {debtsResult.name} <span className="muted">({debtsResult.email})</span>
                    </h3>
                    <p className="mono">{debtsResult.id}</p>
                  </div>

                  {debtsResult.debts.length === 0 ? (
                    <p className="muted">No hay deudas en el rango seleccionado.</p>
                  ) : (
                    <div className="debt-cards">
                      {debtsResult.debts.map((debt) => (
                        <article className="debt-card" key={debt.id}>
                          <div className="debt-card-header">
                            <div>
                              <h4>{debt.description}</h4>
                              <p className="muted">{formatCurrency(debt.totalAmount)}</p>
                            </div>
                            <span className={debt.settled ? "badge success" : "badge warning"}>
                              {debt.settled ? "Saldada" : "Pendiente"}
                            </span>
                          </div>
                          <p className="muted">
                            Creada: {formatDate(debt.createdAt)} | ID: <span className="mono">{debt.id}</span>
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
                                {debt.installments.map((installment) => (
                                  <tr key={installment.id}>
                                    <td>{installment.number}</td>
                                    <td>{installment.dueDate}</td>
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
                        </article>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <p className="muted">Ejecuta una consulta para ver deudas y cuotas.</p>
              )}
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
