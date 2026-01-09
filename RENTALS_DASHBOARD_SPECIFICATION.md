# Rentals Dashboard Specification

> [!NOTE]
> **STATUS: STABLE**
> This document defines the behavior and calculations of the Rentals Dashboard (`/rentals`).
> It serves as the reference for metrics, charts, and economic indicator logic.

---

## Overview

**Purpose:** Display performance metrics for real estate contracts (Owner & Tenant roles).

**Implementation:**
- **View:** `components/rentals/RentalsDashboardView.tsx`
- **API:** `/api/rentals/dashboard`
- **Context:** Economic data (Inflation, Devaluation) is overlaid on contract performance.

---

## Metrics Displayed

### 1. Ingresos Mes Actual (Current Month Income)
- **Scope:** Active contracts where `role = 'OWNER'`
- **Calculation:** Sum of rent amounts for the *current real-time month*.
- **Logic:**
  - If contract has specific data for current month (YYYY-MM), use it.
  - Fallback: Use last available data point if current month not yet generated/recorded.
- **Currency:** Toggleable USD/ARS.

### 2. Gastos Mes Actual (Current Month Expenses)
- **Scope:** Active contracts where `role = 'TENANT'`
- **Calculation:** Sum of rent amounts for the *current real-time month*.
- **Logic:** Same as Income.

### 3. Próximo Vencimiento (Next Expiration)
- **Logic:** Earliest `endDate` >= Today.
- **Grouping:** If multiple contracts expire in the same month, they are grouped.
- **Display:** Property name + Date + Months remaining.

### 4. Próxima Actualización (Next Adjustment)
- **Logic:** Earliest `nextAdjDate` >= Today.
- **Filter:** Only contracts with `adjustmentType = 'IPC'` (or other supported indices).
- **Calculation:** Iterates from start date by frequency (e.g., +3 months) until date >= Today.

---

## Charts and Visualizations

### 1. Historico Global (Global History)
**Type:** Stacked Bar Chart (Income/Expense)

**X-Axis:** Month (e.g., "ene 24")
**Y-Axis:** Total Amount (USD or ARS)

**Data Source:** Aggregation of all active contract cashflows.

### 2. Individual Contract Charts
**Type:** Composed Chart (Bar + Line)

**Bar:** Monthly Rent (USD or ARS)
**Line 1:** Accumulated Inflation (Orange) - from `inflationAccum`
**Line 2:** Accumulated Devaluation (Pink) - from `devaluationAccum`

**Badges (Top Right):**
- **Último:** Last rent amount value.
- **Promedio:** Average rent over the contract life.
- **Infl. Acum:** Total inflation accumulated since contract start.
- **Dev. Acum:** Total devaluation accumulated since contract start.

---

## Critical Rules

### Rule 1: Handling Missing Economic Data (The "January Rule")

**Problem:**
Economic indicators (IPC, Exchange Rates) for the current month are often not yet available (e.g., in Jan 2026, we don't have Jan 2026 IPC yet).

**Behavior:**
- **Charts:** Line stops at the last available data point (API returns `null` for missing months).
- **Badges (Infl/Dev Acum):** MUST show the **last available valid value**, NOT 0%.

**Implementation Reference:**
```typescript
// ✅ CORRECT - Find last non-null value
const lastInf = [...chartData].reverse().find(d => 
    d.inflationAccum !== null && d.inflationAccum !== undefined
)?.inflationAccum ?? 0;
```

**Why:**
Showing "0.0%" implies no inflation, which is misleading. Showing "124%" (last month's data) is accurate context.

### Rule 2: Nominal vs Real Data Cutoff

- **Nominal Data (Rent Amounts):** Shown up to **TODAY** (or current month end). We always know how much the rent is, even if we don't know the inflation yet.
- **Real Data (Inflation/Dev):** Shown up to **LAST AVAILABLE INDICE**.

This allows the user to see their current rent obligation even if the economic context lag exists.

---

## Data Sources

### Contract Cashflow (`RentalCashflow`)
- **amountUSD / amountARS:** Nominal rent values.
- **inflationAccum:** Calculated at generation time based on Indec API.
- **devaluationAccum:** Calculated at generation time based on USD Blue history.

---

## Validation Checklist

- [ ] Does "Ingresos Mes Actual" match reality?
- [ ] Do "Infl. Acum" badges show non-zero values (unless new contract)?
- [ ] If current month is X, and IPC for X is missing, do charts show rent for X but stop inflation line at X-1?
- [ ] Do "Próximo Vencimiento" cards update correctly?
