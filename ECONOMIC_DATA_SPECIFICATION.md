# Economic Data Specification

> [!NOTE]
> **STATUS: STABLE**
> This document defines the sources, handling, and fallback rules for all economic indicators used across the platform.

---

## 1. Exchange Rates (Tipo de Cambio)

**Usage:** Currency conversion (ARS ↔ USD) across all dashboards.

### Sources
1.  **Dólar Blue (Informal):**
    *   **Source:** `Ambito Financiero` API (or scraped).
    *   **Endpoint:** `/api/economic-data/fetch-blue` (Trigger).
    *   **Storage:** `EconomicIndicator` table (`type: 'TC'`, `symbol: 'BLUE'`).
    *   **Frequency:** Daily.

2.  **Dólar Oficial:**
    *   **Source:** BCRA / APIs.
    *   **Storage:** `EconomicIndicator` table (`type: 'TC'`, `symbol: 'OFFICIAL'`).

### Calculation Rules
- **Value Used:** Average of `valueBuy` and `valueSell` if both exist. Otherwise `value`.
- **Historical Lookup:** Exact date match. If missing, look back up to 7 days (e.g. for weekends/holidays).
- **Future/Today:** Use the *latest available* rate in DB.

---

## 2. Inflation (IPC - Índice de Precios al Consumidor)

**Usage:** Rental adjustments, Real adjustments in charts.

### Sources
1.  **INDEC:** Monthly publication.
2.  **Storage:** `EconomicIndicator` table (`type: 'IPC'`).

### Critical Rules
- **Lag:** IPC for Month M is published in Month M+1 (mid-month).
- **Current Month Rule:**
    - If requesting data for current month (e.g. Jan 25) and it's not out yet:
    - **DO NOT** return 0.
    - **DO NOT** predict.
    - **Rule:** Use *Last Available* (Dec 24) for display metrics (like "Inflación Acumulada").
    - **Charts:** Stop line at last valid point.

---

## 3. UVA (Unidades de Valor Adquisitivo)

**Usage:** Mortgage tracking, specific contracts.

### Sources
1.  **BCRA:** Daily publication.
2.  **Storage:** `EconomicIndicator` table (`type: 'UVA'`).

---

## 4. Procedures & Controls

### A. Manual Update (Emergency)
If automatic fetching fails, use the following endpoints or scripts:

1.  **Update Blue:**
    ```bash
    curl -X POST http://localhost:3000/api/economic-data/fetch-blue
    ```

2.  **Update IPC:**
    *   Currently manual insert via Prisma Studio or SQL if API fails.
    *   `npx prisma studio` → `EconomicIndicator` → Add row.

### B. Validation
- Check `/api/economic-data/tc` to verify recent data exists.
- If "Inflación Acumulada" shows 0% in Rentals, check if the latest IPC month is missing in DB.

---

## 5. Integration Points

| Consumer | Metric | Usage |
|----------|--------|-------|
| **Cartera (Dashboard)** | TC Blue | Normalizing portfolio value to USD. |
| **Rentals (Dashboard)** | IPC | Calculating `inflationAccum` for contracts. |
| **Rentals (Dashboard)** | TC Blue | Calculating `devaluationAccum` (USD evolution). |
| **Rentals (Cashflows)** | TC Blue | Converting rent amounts ARS ↔ USD. |

---

## Change Management

- **Adding Source:** Must implement standard `EconomicIndicator` interface.
- **Modifying Fetcher:** Verify parsing logic against source HTML/JSON changes (common failure point).
