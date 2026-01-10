# Barbosa (Hogar) Module Specification

> [!NOTE]
> **STATUS: STABLE**
> This document defines the rules for the "Hogar" (Barbosa) module, specifically focusing on data entry, date handling, and processing rules.

---

## 1. Date Handling & Timezones

### The "January 1st" Problem
**Issue:** Dates are stored as `YYYY-MM-DD 00:00:00 UTC` in the database. When displayed in local time (GMT-3), `01/01/2026 00:00 UTC` becomes `31/12/2025 21:00`, causing transactions to appear in the previous month.

### **CRITICAL RULE: USE UTC FOR GROUPING**

When grouping transactions by month in the Frontend (`TransactionsTab.tsx`, `TransactionTable.tsx`):

**❌ INCORRECT (Local Time):**
```typescript
const date = new Date(tx.date);
const key = `${date.getFullYear()}-${date.getMonth()}`; // Uses local time -> grouped in Dec
```

**✅ CORRECT (UTC):**
```typescript
const date = new Date(tx.date);
const key = `${date.getUTCFullYear()}-${date.getUTCMonth()}`; // Uses UTC -> grouped in Jan
```

**Display Logic:**
- Always render dates using `formatDateUTC` helper or manual UTC string parsing logic to avoid the -3h shift.

---

## 2. Import Rules

### PDF Parsing
- **Engine:** Pure Regex (no AI) for stability and cost.
- **Date Parsing:** Must handle `DD/MM/YYYY` strictly.
- **Installment Detection:** Looks for `(Cuota X/Y)` or `X/Y` patterns.

### Learning System (Categorization)
- When saving a transaction with a Category, the system learns the Description Pattern.
- **Endpoint:** `/api/barbosa/categories/rules`
- **Logic:** Future imports check these rules to auto-assign categories.

---

## 3. Data Integrity & UX

### Transaction Management (UI Feedback)
**CRITICAL:** The "Guardar/Actualizar" (Save/Update) action in `TransactionsTab.tsx` MUST provide visual feedback:
1.  **Success:** `alert('Transacción guardada correctamente')`.
2.  **Error:** `alert('Error al guardar: [Detalle]')`.
3.  **Forbidden:** Silent failure is strictly forbidden. Users must know if their data was not saved.

### Recurrence & Projections
- **Status:** `REAL` (Paid) vs `PROJECTED` (Future).
- **Edit Logic:** Editing a Recurrence Parent (`recurrenceId`) asks to update future events.
- **Cloning:** Cloning a month creates `PROJECTED` copies for the target month.

### Deletion
- **Batch Delete:** Supported relative to `importSource`.
- **Safety:** Always confirm before bulk deletion.

---

## 4. Change Management

- **Modifying Grouping:** verify `TransactionsTab.tsx` grouping function using the "January 1st" test case.
- **Modifying Parser:** Test with a PDF containing "Cuota 1/12" to ensure plan detection works.
