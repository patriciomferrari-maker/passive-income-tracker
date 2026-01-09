# System Controls & Procedures

> [!IMPORTANT]
> **MASTER REFERENCE DOCUMENT**
> This file serves as the central index for all system specifications, controls, and emergency procedures.
> **Last Updated:** 2026-01-09

---

## 1. Documentation Index

### A. Investments (Cartera Argentina)
- **Dashboard Logic:** [`DASHBOARD_SPECIFICATION.md`](file:///c:/Users/patri/.gemini/antigravity/playground/passive_income_tracker/DASHBOARD_SPECIFICATION.md)
  - Defines metrics (TIR, P&L), consolidation rules, and charts.
- **Tabs (Tenencia/Operaciones/Flujo):** [`TABS_SPECIFICATION.md`](file:///c:/Users/patri/.gemini/antigravity/playground/passive_income_tracker/TABS_SPECIFICATION.md)
  - Defines specific tab behavior, currency toggles, and data grids.
- **Currency Rules:** [`CURRENCY_CONVERSION_RULES.md`](file:///c:/Users/patri/.gemini/antigravity/playground/passive_income_tracker/CURRENCY_CONVERSION_RULES.md)
  - **CRITICAL:** Rules for ONs (USD cashflows), bidirectional conversion, and normalization.

### B. Rentals (Alquileres)
- **Dashboard:** [`RENTALS_DASHBOARD_SPECIFICATION.md`](file:///c:/Users/patri/.gemini/antigravity/playground/passive_income_tracker/RENTALS_DASHBOARD_SPECIFICATION.md)
  - Defines Global History, metrics, and "January Rule" for missing data.
- **Individual Tabs:** [`RENTALS_TABS_SPECIFICATION.md`](file:///c:/Users/patri/.gemini/antigravity/playground/passive_income_tracker/RENTALS_TABS_SPECIFICATION.md)
  - Defines "Flujo Individual" and data freshness requirements (No "Recalculate" button).

### C. Core Data
- **Economic Indicators:** [`ECONOMIC_DATA_SPECIFICATION.md`](file:///c:/Users/patri/.gemini/antigravity/playground/passive_income_tracker/ECONOMIC_DATA_SPECIFICATION.md)
  - Defines sources for Dólar Blue, IPC, UVA, and update frequency.

---

## 2. Emergency Procedures

### A. Data Corruption / Inconsistency
**Symptom:** Dashboard numbers don't match Tenencia, or TIR is 0%.
**Action:**
1.  Run Validation:
    ```bash
    curl http://localhost:3000/api/investments/on/validate
    ```
2.  Check Specific Spec: Refer to the relevant dashboard spec above.
3.  Check `CURRENCY_CONVERSION_RULES.md` for common regressions (e.g. double conversion).

### B. Missing Economic Data (e.g. 0% Inflation)
**Symptom:** Charts flatline or badges show 0%.
**Action:**
1.  Check `ECONOMIC_DATA_SPECIFICATION.md`.
2.  Verify `EconomicIndicator` table has recent data.
3.  Run manual fetch:
    ```bash
    curl -X POST http://localhost:3000/api/economic-data/fetch-blue
    ```
4.  If IPC is missing for current month, this is EXPECTED behavior. Ensure code uses fallback (see "January Rule" in Rentals Spec).

---

## 3. Deployment Controls

Before merging/deploying changes:

- [ ] **Specs Updated?** Have you updated the relevant `.md` file?
- [ ] **Validation Pass?** Does `/api/investments/on/validate` return true?
- [ ] **No Regression:** Do "Tenencia" and "Dashboard" totals match?

---

## 4. System Architecture Notes

- **Source of Truth:**
  - **Positions:** `Tenencia` (Calculated from Transactions).
  - **Rentals:** `RentalCashflow` (Generated stored records).
  - **Economic Data:** `EconomicIndicator` (DB records, never live fetch from external API in frontend).

- **Currency Philosophy:**
  - **Database:** Store in ORIGINAL currency (or USD for ONs).
  - **Frontend:** Convert ON VIEW.
  - **Backend Calculation:** Normalize to USD for aggregation.
