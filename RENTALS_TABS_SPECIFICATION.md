# Rentals Tabs Specification

> [!NOTE]
> **STATUS: STABLE**
> This document defines the behavior of the specific tabs within the Rentals section (`/rentals`).
> For the main Dashboard view specification, see [`RENTALS_DASHBOARD_SPECIFICATION.md`](file:///c:/Users/patri/.gemini/antigravity/playground/passive_income_tracker/RENTALS_DASHBOARD_SPECIFICATION.md).

---

## 1. Flujo Individual (`IndividualCashflowTab`)

**Purpose:** detailed audit and analysis of a single rental contract's performance over time.

### Core Features

1.  **Contract Selector**: Dropdown to switch between active and inactive contracts.
2.  **Automated Data Freshness**:
    *   **Behavior**: Cashflows and economic indicators (IPC, USD Blue) are loaded fresh from the database.
    *   **Auto-Update**: There is **NO** manual "Recalcular" button. The system assumes backend scheduled tasks or generation triggers keep `RentalCashflow` up to date.
    *   **Logic**: If economic data changes (e.g. new IPC released), the backend should update the `RentalCashflow` records. The frontend simply displays what's in the DB.

### Metrics & Cards

#### A. Propiedad & Inquilino
- Displays static contract info.

#### B. Valor Actual (Current Value)
- **Calculation**: Latest available rent amount (ARS or USD) from the cashflow list.
- **Base**: Shows `initialRent` for comparison.
- **Growth %**: `((Current - Initial) / Initial) * 100`.
- **Logic**: Uses the last cashflow with date <= Today as the "Current".

#### C. Vencimiento (Expiration)
- **Display**: End date of contract.
- **Countdown**: Months remaining from today.

#### D. Próximo Ajuste (Next Adjustment)
- **Logic**: Iterative calculation based on `startDate` + `frequency` (e.g. 6 months).
- **Display**: Next valid date >= Today.

#### E. Indcadores Acumulados (Inflation/Devaluation)
- **Logic**: Shows the *latest available* valid data point from the cashflow history.
- **Code Reference**:
  ```typescript
  // Finds last non-null value, ignoring future nulls
  const validInflation = [...cashflows].reverse().find(c => c.inflationAccum !== null)?.inflationAccum;
  ```

### Cashflow Table

**Columns:**
- **Mes**: Index (1, 2, 3...)
- **Fecha**: Due date
- **Monto ARS/USD**: Nominal values.
- **IPC Mes/Acum**: Inflation data stored in `RentalCashflow`.
- **TC**: Exchange rate stored in `RentalCashflow`.
- **Inflación/Devaluación Total**: Comparison vs contract start.

**Logic**:
- **Source of Truth**: The `RentalCashflow` table in PostgreSQL.
- **Display**: Raw values from DB. No client-side recalculation of economic indicators.

---

## 2. Flujo Consolidado

*Specification to be added when this feature is fully stabilized.*

---

## 3. Propiedades & Contratos

*Standard CRUD interfaces for `Property` and `Contract` models.*

---

## Change Management Protocol

### Removing Features
We recently removed the "Recalcular" button (2026-01-09) because:
1.  It implies manual intervention is needed for accuracy.
2.  It relied on a client-side trigger to a backend regeneration endpoint.
3.  **New Standard**: Data must be correct on load. If outdated, the *backend* process needs fixing, not a frontend button.

### Adding Metrics
Any new metric (e.g., "Yield Real") must:
1.  Example: Be calculated in the backend `RentalCashflow` or computed consistently on the frontend using *only* available fields.
2.  Handle missing future economic data gracefully (return `null` or last valid, do not error).
