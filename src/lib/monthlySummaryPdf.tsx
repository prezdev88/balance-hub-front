import React from "react";
import { Document, Page, Text, View, StyleSheet, pdf } from "@react-pdf/renderer";
import type { MonthlySummaryReportResponse } from "../types";

const MONTH_LABELS = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre"
];

const styles = StyleSheet.create({
  page: {
    padding: 28,
    fontSize: 10,
    color: "#1f2a37"
  },
  header: {
    backgroundColor: "#0f2d52",
    color: "#ffffff",
    padding: 12,
    borderRadius: 6,
    marginBottom: 12
  },
  title: {
    fontSize: 16,
    fontWeight: 700
  },
  subtitle: {
    marginTop: 4,
    fontSize: 10
  },
  section: {
    marginTop: 10
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 700,
    marginBottom: 6
  },
  infoCard: {
    border: "1 solid #d9e4f2",
    borderRadius: 6,
    padding: 10,
    backgroundColor: "#f8fbff"
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 3
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  highlightMetric: {
    width: "100%",
    border: "2 solid #1f8f4e",
    borderRadius: 8,
    padding: 10,
    backgroundColor: "#eefaf3"
  },
  highlightMetricLabel: {
    fontSize: 10,
    color: "#1f8f4e",
    fontWeight: 700
  },
  highlightMetricValue: {
    marginTop: 3,
    fontSize: 16,
    fontWeight: 800,
    color: "#14532d"
  },
  metric: {
    width: "48%",
    border: "1 solid #d9e4f2",
    borderRadius: 6,
    padding: 8,
    backgroundColor: "#ffffff"
  },
  metricLabel: {
    fontSize: 9,
    color: "#4b5563"
  },
  metricValue: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: 700
  },
  installmentCards: {
    marginTop: 4,
    gap: 8
  },
  installmentCard: {
    border: "1 solid #d5e2f3",
    borderRadius: 8,
    padding: 8,
    backgroundColor: "#f9fbff"
  },
  installmentCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6
  },
  installmentDebt: {
    fontSize: 10,
    fontWeight: 700,
    width: "74%"
  },
  installmentState: {
    fontSize: 9,
    fontWeight: 700
  },
  kvRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 2
  },
  kvLabel: {
    color: "#4b5563",
    width: "44%"
  },
  kvValue: {
    width: "56%",
    textAlign: "right"
  },
  bold: { fontWeight: 700 },
  paid: { color: "#1e7f4e", fontWeight: 700 },
  pending: { color: "#9a5d00", fontWeight: 700 },
  muted: { color: "#6b7280" }
});

function formatCurrency(value: string | number): string {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return String(value);
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0
  }).format(n);
}

function formatDate(date: string | null): string {
  if (!date) return "-";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString("es-CL");
}

function formatDateTime(date: string | null): string {
  if (!date) return "-";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return date;
  return `${d.toLocaleDateString("es-CL")} ${d.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}`;
}

function monthYear(month: number, year: number): string {
  return `${MONTH_LABELS[month - 1] ?? month} ${year}`;
}

function salaryStatusText(status: MonthlySummaryReportResponse["salaryStatus"]): string {
  if (!status) return "Preview";
  return status === "PAID" ? "Pagado" : "Pendiente";
}

function MonthlySummaryPdfDocument({ report }: { report: MonthlySummaryReportResponse }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>Balance Hub</Text>
          <Text style={styles.subtitle}>Resumen mensual - {monthYear(report.month, report.year)}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Deudor</Text>
          <View style={styles.infoCard}>
            <View style={styles.row}>
              <Text style={styles.bold}>{report.debtorName}</Text>
              <Text>{salaryStatusText(report.salaryStatus)}</Text>
            </View>
            <Text>{report.debtorEmail}</Text>
            <Text style={styles.muted}>Pago sueldo: {formatDateTime(report.salaryPaidAt)}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Resumen financiero</Text>
          <View style={styles.metricsGrid}>
            <View style={styles.highlightMetric}>
              <Text style={styles.highlightMetricLabel}>Disponible final</Text>
              <Text style={styles.highlightMetricValue}>{formatCurrency(report.salaryColumnAmount)}</Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>Monto libre mensual</Text>
              <Text style={styles.metricValue}>{formatCurrency(report.monthlyFreeAmount)}</Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>Mitad monto libre</Text>
              <Text style={styles.metricValue}>{formatCurrency(report.halfFreeAmount)}</Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>Total cuotas</Text>
              <Text style={styles.metricValue}>{formatCurrency(report.totalInstallmentsAmount)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Detalle de cuotas</Text>
          {report.installments.length === 0 ? (
            <View style={styles.installmentCard}>
              <Text style={styles.muted}>Sin cuotas para el periodo.</Text>
            </View>
          ) : (
            <View style={styles.installmentCards}>
              {report.installments.map((item) => (
                <View key={item.installmentId} style={styles.installmentCard}>
                  <View style={styles.installmentCardHeader}>
                    <Text style={styles.installmentDebt}>{item.debtDescription}</Text>
                    <Text style={[styles.installmentState, item.paid ? styles.paid : styles.pending]}>
                      {item.paid ? "Pagada" : "Pendiente"}
                    </Text>
                  </View>
                  <View style={styles.kvRow}>
                    <Text style={styles.kvLabel}>Monto</Text>
                    <Text style={styles.kvValue}>{formatCurrency(item.amount)}</Text>
                  </View>
                  <View style={styles.kvRow}>
                    <Text style={styles.kvLabel}>Vencimiento</Text>
                    <Text style={styles.kvValue}>{formatDate(item.dueDate)}</Text>
                  </View>
                  <View style={styles.kvRow}>
                    <Text style={styles.kvLabel}>Cuota</Text>
                    <Text style={styles.kvValue}>
                      {item.installmentNumber}/{item.totalInstallments}
                    </Text>
                  </View>
                  <View style={styles.kvRow}>
                    <Text style={styles.kvLabel}>Pagada</Text>
                    <Text style={styles.kvValue}>{formatDateTime(item.paidAt)}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </Page>
    </Document>
  );
}

export async function generateMonthlySummaryPdfBlob(report: MonthlySummaryReportResponse): Promise<Blob> {
  return pdf(<MonthlySummaryPdfDocument report={report} />).toBlob();
}
