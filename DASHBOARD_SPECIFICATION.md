# Dashboard Tab Specification

> [!CAUTION]
> **CRITICAL REFERENCE DOCUMENT - STATUS: STABLE**
> 
> This document defines the EXACT behavior and calculations of the Dashboard tab.
> DO NOT modify Dashboard without:
> 1. Reviewing [`DASHBOARD_RULES.md`](file:///c:/Users/patri/.gemini/antigravity/playground/passive_income_tracker/DASHBOARD_RULES.md) (REQUIRED)
> 2. Asking user for approval
> 3. Updating this specification
> 4. Running validation endpoint

---

## Overview

**Purpose:** Display comprehensive portfolio analytics for "Cartera Argentina" (Argentine Portfolio - ONs, CEDEARs, ETFs).

**Current Implementation:**
- **Wrapper:** `components/on/DashboardTab.tsx`
- **View:** `components/on/InvestmentsDashboardView.tsx`
- **API:** `/api/investments/on/dashboard`
- **Currency:** Always USD (all calculations normalized)
- **Source of Truth:** Internally calls Positions API for validation

---

## Metrics Displayed

### 1. Capital Metrics

#### Capital Invertido (Total Investment)
- **Source:** Positions API (Tenencia) - SOURCE OF TRUTH
- **Calculation:** `sum(quantity * buyPrice + buyCommission)` from all open positions
- **Currency:** USD (transactions normalized before sum)
- **Validation:** MUST match Tenencia tab total

#### Valor Actual (Current Value)
- **Source:** Positions API (Tenencia) - SOURCE OF TRUTH
- **Calculation:** `sum(quantity * sellPrice)` from all open positions  
- **Currency:** USD
- **Validation:** MUST match Tenencia tab total

### 2. Cashflow Metrics

#### Capital Cobrado (Principal Received)
- **Source:** Projected cashflows with `type = 'AMORTIZATION'` and `date <= today`
- **Includes:** Past amortization payments
- **Currency:** USD (cashflows already in USD for ONs)

#### Interés Cobrado (Interest Received)
- **Source:** Projected cashflows with `type = 'INTEREST'` and `date <= today`
- **Includes:** Past interest payments
- **Currency:** USD

#### Capital a Cobrar (Principal To Receive)
- **Source:** Projected cashflows with `type = 'AMORTIZATION'` and `date > today`
- **Includes:** Future amortization payments
- **Currency:** USD

#### Interés a Cobrar (Interest To Receive)
- **Source:** Projected cashflows with `type = 'INTEREST'` and `date > today`
- **Includes:** Future interest payments
- **Currency:** USD

#### Total a Cobrar
- **Calculation:** `Capital a Cobrar + Interés a Cobrar`
- **Currency:** USD

### 3. Performance Metrics

#### ROI (Return on Investment)
- **Formula:** `((Total Retorno - Capital Invertido) / Capital Invertido) * 100`
- **Where:** `Total Retorno = Capital Cobrado + Interés Cobrado + Capital a Cobrar + Interés a Cobrar`
- **Display:** Percentage with 2 decimals
- **Example:** 15.50%

#### TIR Consolidada (Consolidated IRR)
- **Method:** XIRR (Extended Internal Rate of Return)
- **Inputs:**
  - All BUY transactions (negative, normalized to USD)
  - ALL cashflows - past AND future (in USD)
- **Critical:** Uses `cf.currency` not `inv.currency`
- **Display:** Percentage with 2 decimals
- **Validation:** Should NOT be 0% or NULL if portfolio has cashflows

### 4. Próximo Pago (Next Payment)
- **Source:** Earliest future cashflow with `status = 'PROJECTED'` and `date > today`
- **Includes:** ticker, name, date, amount, type, description
- **Display:** Date + Amount in card

---

## Charts and Visualizations

### 1. Composición del Portfolio (Portfolio Breakdown)
**Type:** Pie Chart

**Data Source:** Per-investment calculations

**Per Investment:**
```typescript
invested = sum(transactions normalized to USD)
percentage = (invested / capitalInvertido) * 100
```

**Critical Rules:**
- ✅ MUST normalize transactions to USD using `tx.currency`
- ✅ Convert ARS transactions using `getExchangeRate(tx.date)`
- ❌ NEVER sum `tx.totalAmount` directly without checking currency

**Display:**
- Segment per ticker
- Shows: ticker name, amount, percentage
- Hover shows detailed value
- Colors from COLORS array

**Validation:**
- Sum of all `invested` values MUST equal `capitalInvertido`

### 2. Portfolio Breakdown Table
**Columns:**
- **Ticker:** Investment ticker symbol
- **Nombre:** Investment name
- **Invertido:** Amount invested (normalized USD)
- **%:** Percentage of total portfolio
- **TIR:** Individual TIR for this investment
- **TIR Teórica:** Theoretical TIR from Positions API (for ONs)

**Sorting:** By invested amount (descending)

### 3. Pagos Próximos (Upcoming Payments)
**Type:** Bar Chart

**Data Source:** Future cashflows within next 12 months

**Filters:**
- `status = 'PROJECTED'`
- `date > today`
- `date <= today + 12 months`
- Limited to 50 payments for performance

**X-Axis:** Date (formatted)
**Y-Axis:** Amount in USD
**Color:** By cashflow type (interest/amortization)

### 4. P&L (Profit & Loss) - Optional
**Condition:** Only shown if portfolio has equity (stocks/CEDEARs)

**Metrics:**
- **Realized P&L:** From closed positions
- **Unrealized P&L:** From open equity positions
- **Total P&L:** Sum of realized + unrealized

---

## Critical Implementation Rules

### Rule 1: Always Use Positions API for Core Metrics

```typescript
// ✅ CORRECT - Call Positions API internally
const positionsRes = await fetch('/api/investments/positions?market=ARG&currency=USD');
const positions = await positionsRes.json();

const capitalInvertido = positions.reduce((sum, p) => 
    sum + (p.quantity * p.buyPrice + p.buyCommission), 0
);
const totalCurrentValue = positions.reduce((sum, p) => 
    sum + (p.quantity * (p.sellPrice || 0)), 0
);

// Use these as SOURCE OF TRUTH
```

### Rule 2: Normalize ALL Transactions to USD

**For Portfolio Breakdown:**
```typescript
// ✅ CORRECT
const invested = inv.transactions.reduce((sum, tx) => {
    let txAmount = Math.abs(tx.totalAmount);
    const txCurrency = tx.currency || inv.currency;
    
    if (txCurrency === 'ARS') {
        const rate = getExchangeRate(new Date(tx.date));
        txAmount = txAmount / rate;
    }
    
    return sum + txAmount;
}, 0);
```

### Rule 3: Use Cashflow Currency for TIR

**For TIR Calculations:**
```typescript
// ✅ CORRECT - Check cf.currency not inv.currency
inv.cashflows.forEach(cf => {
    let amount = cf.amount;
    const cfCurrency = cf.currency || inv.currency;
    
    if (cfCurrency === 'ARS') {
        const rate = getExchangeRate(new Date(cf.date));
        amount = amount / rate;
    }
    
    allAmounts.push(amount);
});
```

### Rule 4: Filter Projected Cashflows for UI Display

```typescript
// For UI metrics (Capital Cobrado, Interés Cobrado, etc)
inv.cashflows.forEach(cf => {
    if (cf.status !== 'PROJECTED') return; // Only projected for UI
    
    if (cf.type === 'AMORTIZATION') {
        if (cfDate <= today) capitalCobrado += cf.amount;
        else capitalACobrar += cf.amount;
    }
});

// For TIR calculation - use ALL cashflows
inv.cashflows.forEach(cf => {
    // No status filter - include all for accurate TIR
    allAmounts.push(cf.amount);
});
```

---

## API Response Structure

```typescript
{
  // Core Metrics (from Positions API)
  capitalInvertido: number,        // Total invested (USD)
  totalCurrentValue: number,        // Current value (USD)
  
  // Cashflow Metrics
  capitalCobrado: number,           // Principal received (USD)
  interesCobrado: number,           // Interest received (USD)
  capitalACobrar: number,           // Principal to receive (USD)
  interesACobrar: number,           // Interest to receive (USD)
  totalACobrar: number,             // Total to receive (USD)
  
  // Performance
  roi: number,                      // ROI percentage
  tirConsolidada: number,           // Consolidated TIR percentage
  
  // Next Payment
  proximoPago: {
    ticker: string,
    name: string,
    date: string,
    amount: number,
    type: string,
    description: string
  } | null,
  
  // Upcoming Payments Chart Data
  upcomingPayments: Array<{
    date: string,
    amount: number,
    type: string,
    ticker: string,
    name: string,
    description: string
  }>,
  
  // Portfolio Breakdown
  portfolioBreakdown: Array<{
    ticker: string,
    name: string,
    invested: number,              // Normalized to USD
    percentage: number,
    tir: number,                   // Individual TIR
    theoreticalTir: number | null, // From Positions API
    type: string
  }>,
  
  // P&L (if has equity)
  pnl: {
    realized: number,
    realizedPercent: number,
    unrealized: number,
    unrealizedPercent: number,
    hasEquity: boolean
  } | null
}
```

---

## Dashboard Consolidation Rules

> [!CAUTION]
> **CRITICAL: How Metrics MUST Relate to Each Other**
> 
> The Dashboard displays multiple metrics that are INTERDEPENDENT.
> These rules define how they must be consistent with each other and with Tenencia.

### Rule 1: Tenencia is the Single Source of Truth

**Principle:** Dashboard does NOT calculate core metrics independently. It MUST call Positions API.

```typescript
// ✅ CORRECT - Dashboard calls Tenencia internally
const positionsRes = await fetch('/api/investments/positions?market=ARG&currency=USD');
const positions = await positionsRes.json();

// These ARE the authoritative values
const capitalInvertido = positions.reduce((sum, p) => 
    sum + (p.quantity * p.buyPrice + p.buyCommission), 0
);
const totalCurrentValue = positions.reduce((sum, p) => 
    sum + (p.quantity * (p.sellPrice || 0)), 0
);
```

**Validation:**
```javascript
Dashboard.capitalInvertido === Tenencia.totalInversion // MUST be true
Dashboard.totalCurrentValue === Tenencia.totalValorActual // MUST be true
// Tolerance: ±$0.01 for floating point
```

### Rule 2: Portfolio Breakdown Must Sum to Capital Invertido

**Principle:** The pie chart segments MUST add up to the total investment.

```typescript
const portfolioBreakdown = investments.map(inv => ({
    invested: calculateInvestedUSD(inv), // Normalized to USD
    percentage: (invested / capitalInvertido) * 100
}));

// VALIDATION:
const sumOfInvested = portfolioBreakdown.reduce((sum, item) => sum + item.invested, 0);
Math.abs(sumOfInvested - capitalInvertido) < 0.01 // MUST be true
```

**Common Error:**
- If you see portfolio chart showing "$9M" but capitalInvertido is "$20K", transactions weren't normalized
- Check: each `invested` value uses `tx.currency` not raw `tx.totalAmount`

### Rule 3: ROI Calculation Consistency

**Formula:** `ROI = ((Total Retorno - Capital Invertido) / Capital Invertido) * 100`

**Where:**
- `Total Retorno = Capital Cobrado + Interés Cobrado + Capital a Cobrar + Interés a Cobrar`
- `Capital Invertido` = From Tenencia (Rule 1)

**Validation:**
```javascript
const totalRetorno = capitalCobrado + interesCobrado + capitalACobrar + interesACobrar;
const expectedROI = ((totalRetorno - capitalInvertido) / capitalInvertido) * 100;
Math.abs(roi - expectedROI) < 0.01 // MUST be true
```

**Example:**
```
Capital Invertido: $10,000
Capital Cobrado: $2,000
Interés Cobrado: $800
Capital a Cobrar: $8,000
Interés a Cobrar: $1,200

Total Retorno = 2000 + 800 + 8000 + 1200 = $12,000
Ganancia = 12000 - 10000 = $2,000
ROI = (2000 / 10000) * 100 = 20%
```

### Rule 4: Cashflow Metrics Consistency

**Principle:** Past + Future = Total Expected

```javascript
// For Amortization
capitalCobrado + capitalACobrar = totalExpectedAmortization

// For Interest  
interesCobrado + interesACobrar = totalExpectedInterest

// Combined
totalACobrar = capitalACobrar + interesACobrar // By definition
```

**Validation:**
```javascript
// These must use ONLY projected cashflows
const projectedCashflows = investments.flatMap(inv => 
    inv.cashflows.filter(cf => cf.status === 'PROJECTED')
);

const totalAmortizationProjected = projectedCashflows
    .filter(cf => cf.type === 'AMORTIZATION')
    .reduce((sum, cf) => sum + cf.amount, 0);

const totalInterestProjected = projectedCashflows
    .filter(cf => cf.type === 'INTEREST')
    .reduce((sum, cf) => sum + cf.amount, 0);

// Validation
capitalCobrado + capitalACobrar === totalAmortizationProjected // SHOULD be true
interesCobrado + interesACobrar === totalInterestProjected // SHOULD be true
```

### Rule 5: TIR Consolidada Input Consistency

**Principle:** TIR uses ALL cashflows (past + future), not just projected for UI.

```typescript
// For TIR calculation - use ALL cashflows
inv.cashflows.forEach(cf => {
    // NO status filter - include all
    let amount = cf.amount;
    const cfCurrency = cf.currency || inv.currency;
    
    if (cfCurrency === 'ARS') {
        amount = amount / getExchangeRate(new Date(cf.date));
    }
    
    allAmounts.push(amount);
    allDates.push(new Date(cf.date));
});

// Transactions MUST also be normalized
inv.transactions.forEach(tx => {
    let txAmount = Math.abs(tx.totalAmount);
    if (tx.currency === 'ARS') {
        txAmount = txAmount / getExchangeRate(new Date(tx.date));
    }
    allAmounts.push(-txAmount); // Negative for outflow
    allDates.push(new Date(tx.date));
});
```

**Validation:**
```javascript
// TIR calculation inputs
allAmounts.length === totalTransactions + totalCashflows
allAmounts.some(a => a < 0) // Has outflows (transactions)
allAmounts.some(a => a > 0) // Has inflows (cashflows)
```

**Expected TIR Range:**
- ONs típicas: 5% - 25% anual
- If TIR = 0% → Error in currency conversion
- If TIR = NULL% → No valid cashflows or convergence issue

### Rule 6: Próximo Pago Consistency

**Principle:** Must be the earliest future projected cashflow.

```javascript
const allFutureCashflows = investments
    .flatMap(inv => inv.cashflows)
    .filter(cf => 
        cf.status === 'PROJECTED' && 
        new Date(cf.date) > new Date()
    )
    .sort((a, b) => new Date(a.date) - new Date(b.date));

const proximoPago = allFutureCashflows[0];

// Validation
if (proximoPago) {
    new Date(proximoPago.date) > new Date() // MUST be true
    proximoPago.status === 'PROJECTED' // MUST be true
}
```

### Rule 7: P&L Consistency (If Has Equity)

**Principle:** P&L comes from Positions API, already calculated with FIFO.

```javascript
// From Positions API
const totalRealized = positions
    .filter(p => p.status === 'CLOSED')
    .reduce((sum, p) => sum + (p.resultAbs || 0), 0);

const totalUnrealized = positions
    .filter(p => p.status === 'OPEN')
    .reduce((sum, p) => sum + (p.resultAbs || 0), 0);

// Validation
pnl.realized === totalRealized // MUST match
pnl.unrealized === totalUnrealized // MUST match
pnl.hasEquity === positions.some(p => isEquity(p.type)) // MUST match
```

---

## Consolidated Validation Matrix

| Metric | Source | Must Match | Tolerance |
|--------|--------|------------|-----------|
| **Capital Invertido** | Tenencia API | Tenencia total | ±$0.01 |
| **Valor Actual** | Tenencia API | Tenencia total | ±$0.01 |
| **Portfolio Breakdown Sum** | Calculated | Capital Invertido | ±$0.01 |
| **Total a Cobrar** | Calculated | Capital a Cobrar + Interés a Cobrar | Exact |
| **ROI** | Formula | `((Retorno - Inv) / Inv) * 100` | ±0.01% |
| **TIR Consolidada** | XIRR | Valid range 5-25% typical | N/A |
| **Próximo Pago Date** | Min future date | > Today | N/A |
| **P&L Realized** | Tenencia API | Sum of closed positions | ±$0.01 |
| **P&L Unrealized** | Tenencia API | Sum of open equity P&L | ±$0.01 |

---

## End-to-End Validation Procedure

### Step 1: Verify Source of Truth
```bash
# Get Tenencia values
curl 'http://localhost:3000/api/investments/positions?market=ARG&currency=USD'

# Note these values:
# - Sum of (quantity * buyPrice + buyCommission) = Tenencia Total Inversión
# - Sum of (quantity * sellPrice) = Tenencia Total Valor Actual
```

### Step 2: Verify Dashboard Core Metrics
```bash
# Get Dashboard
curl 'http://localhost:3000/api/investments/on/dashboard'

# Compare:
# Dashboard.capitalInvertido === Tenencia Total Inversión (±$0.01)
# Dashboard.totalCurrentValue === Tenencia Total Valor Actual (±$0.01)
```

### Step 3: Verify Portfolio Breakdown
```javascript
// In browser console on Dashboard
const breakdown = dashboardData.portfolioBreakdown;
const sum = breakdown.reduce((s, item) => s + item.invested, 0);
const diff = Math.abs(sum - dashboardData.capitalInvertido);
console.log(`Portfolio breakdown sum: $${sum.toFixed(2)}`);
console.log(`Capital invertido: $${dashboardData.capitalInvertido.toFixed(2)}`);
console.log(`Difference: $${diff.toFixed(2)} (should be < 0.01)`);
```

### Step 4: Verify ROI Calculation
```javascript
const retorno = data.capitalCobrado + data.interesCobrado + 
                data.capitalACobrar + data.interesACobrar;
const expectedROI = ((retorno - data.capitalInvertido) / data.capitalInvertido) * 100;
const diff = Math.abs(data.roi - expectedROI);
console.log(`Expected ROI: ${expectedROI.toFixed(2)}%`);
console.log(`Actual ROI: ${data.roi.toFixed(2)}%`);
console.log(`Difference: ${diff.toFixed(2)}% (should be < 0.01)`);
```

### Step 5: Verify TIR is Valid
```javascript
console.log(`TIR Consolidada: ${data.tirConsolidada.toFixed(2)}%`);
// Should be:
// - NOT 0%
// - NOT NULL% or NaN%
// - Typically between 5% and 25% for ONs
// - If outside range, check currency conversions
```

### Step 6: Run Automated Validation
```bash
curl 'http://localhost:3000/api/investments/on/validate'

# Expected response:
{
  "isValid": true,
  "checks": [
    {"name": "Inversión Total", "passed": true},
    {"name": "Valor Actual", "passed": true},
    {"name": "ON Cashflows in USD", "passed": true}
  ],
  "warnings": []
}
```

---

## Troubleshooting Common Inconsistencies

### Issue: Portfolio Chart Sum ≠ Capital Invertido

**Symptoms:**
- Chart shows total $9M but Capital Invertido is $20K
- Individual segments show very large numbers

**Cause:** Transactions not normalized to USD

**Fix:**
```typescript
// In portfolioBreakdown calculation
const invested = inv.transactions.reduce((sum, tx) => {
    let txAmount = Math.abs(tx.totalAmount);
    const txCurrency = tx.currency || inv.currency;
    
    // MUST convert ARS to USD
    if (txCurrency === 'ARS') {
        const rate = getExchangeRate(new Date(tx.date));
        txAmount = txAmount / rate;
    }
    
    return sum + txAmount;
}, 0);
```

### Issue: ROI Doesn't Match Formula

**Symptoms:**
- Manual calculation gives different ROI than displayed

**Cause:** Using wrong values for calculation

**Fix:**
- Ensure `capitalInvertido` comes from Tenencia
- Ensure cashflow metrics use ONLY `status === 'PROJECTED'`
- Recalculate manually to verify

### Issue: TIR Consolidada = 0%

**Symptoms:**
- TIR shows exactly 0%

**Cause:** Cashflows divided incorrectly (using `inv.currency` instead of `cf.currency`)

**Fix:**
```typescript
// Use cf.currency not inv.currency
const cfCurrency = cf.currency || inv.currency;
if (cfCurrency === 'ARS') {
    amount = amount / rate;
}
```

### Issue: Tenencia ≠ Dashboard

**Symptoms:**
- Validation endpoint shows `isValid: false`
- Dashboard totals don't match Tenencia tab

**Cause:** Dashboard not calling Positions API internally

**Fix:**
```typescript
// Dashboard MUST call Positions API
const positionsRes = await fetch('/api/investments/positions?market=ARG&currency=USD');
const positions = await positionsRes.json();

// Use these values directly
const capitalInvertido = positions.reduce(...);
const totalCurrentValue = positions.reduce(...);
```

---

## Validation Requirements

### Automated Checks

**Endpoint:** `GET /api/investments/on/validate`

**Checks:**
1. ✅ `capitalInvertido` (Dashboard) == sum of Tenencia positions
2. ✅ `totalCurrentValue` (Dashboard) == sum of Tenencia current values
3. ✅ All ON cashflows have `currency = 'USD'`
4. ✅ Portfolio breakdown sum == `capitalInvertido`
5. ✅ TIR consolidada is not 0% or NULL (if has cashflows)

### Manual Validation

**After any Dashboard changes:**

1. **Compare with Tenencia:**
   - Open Tenencia tab
   - Note "Total Inversión" and "Valor Actual"
   - Open Dashboard
   - Values MUST match exactly (tolerance: $0.01)

2. **Check Portfolio Chart:**
   - Hover over each segment
   - Values should be in reasonable USD range (not millions)
   - DNC3D example: ~$6,000 USD (not $9,050,029 ARS)

3. **Verify TIR:**
   - TIR Consolidada should show percentage (e.g., 12.50%)
   - Should NOT show 0%, NULL%, or NaN%

4. **Test Próximo Pago:**
   - Should show next upcoming payment
   - Date should be in future
   - Amount should be reasonable

---

## Privacy Mode

**Feature:** Hide/show monetary values

**Implementation:**
- `showValues` prop from parent
- When `false`, displays `****` instead of amounts
- Does not affect calculations, only display

**Storage:** `localStorage.getItem('privacy_mode')`

---

## Error Handling

### 401 Unauthorized
- Shows "Sesión Expirada" message
- Provides link to `/login`

### Generic Errors
- Shows "No se pudo cargar la información"
- Logs detailed error to console

### Loading State
- Shows "Cargando dashboard..." message

---

## Dependencies

**Required APIs:**
- `/api/investments/positions?market=ARG&currency=USD` - Source of truth
- `/api/economic-data/tc` - Exchange rates (for normalization)

**Required Functions:**
- `calculateXIRR(amounts, dates)` - From `@/lib/financial`
- `getExchangeRate(date)` - Fetches historical USD/ARS rate
- `getUserId()` - Authentication

**Database Tables:**
- `Investment` - Portfolio items
- `Transaction` - Buy/sell transactions
- `Cashflow` - Interest and amortization payments
- `EconomicIndicator` - Exchange rates

---

## Change Management Protocol

> [!WARNING]
> **MANDATORY BEFORE CHANGES**

**Step 1: Review Rules**
- [ ] Read [`DASHBOARD_RULES.md`](file:///c:/Users/patri/.gemini/antigravity/playground/passive_income_tracker/DASHBOARD_RULES.md) completely
- [ ] Review all 4 rules
- [ ] Check "Common Mistakes" section
- [ ] Review checklist

**Step 2: Ask User**
```
❓ This change would modify [describe behavior].
   Should I update DASHBOARD_SPECIFICATION.md?
```

**Step 3: Implement with Care**
- Use correct currency fields (`tx.currency`, `cf.currency`)
- Never use `inv.currency` to decide conversion
- Normalize to USD BEFORE aggregating

**Step 4: Validate**
```bash
# Run validation endpoint
curl http://localhost:3000/api/investments/on/validate

# Check specific metrics
# - capitalInvertido should match Tenencia
# - TIR consolidada should not be 0%
# - Portfolio chart values should be in USD
```

**Step 5: Update Documentation**
- Update this file if behavior changed
- Update DASHBOARD_RULES.md if new rule applies
- Commit with detailed description

---

## Testing Checklist

- [ ] Dashboard loads without errors
- [ ] Capital Invertido matches Tenencia tab
- [ ] Valor Actual matches Tenencia tab
- [ ] Portfolio pie chart shows USD values
- [ ] TIR consolidada shows valid percentage
- [ ] Próximo Pago displays correctly
- [ ] Upcoming payments chart renders
- [ ] Privacy mode toggles values
- [ ] Validation endpoint returns `isValid: true`
- [ ] No console errors

---

## Known Issues & Fixes

### Issue #1: Portfolio chart showing ARS values (Fixed 2026-01-09)
**Symptom:** DNC3D showing $9,050,029 instead of $6,000
**Cause:** Not normalizing transactions to USD
**Fix:** Added currency normalization in portfolioBreakdown calculation

### Issue #2: TIR individual mixing currencies (Fixed 2026-01-09)
**Symptom:** Individual TIR calculations incorrect
**Cause:** Using `tx.totalAmount` directly without checking `tx.currency`
**Fix:** Normalize transactions before XIRR calculation

### Issue #3: TIR consolidada showing 0% (Fixed 2026-01-09)
**Symptom:** TIR Consolidada = 0%
**Cause:** Using `inv.currency` instead of `cf.currency`, dividing USD by exchange rate
**Fix:** Check `cf.currency` before converting cashflows

---

## Related Documentation

- [`DASHBOARD_RULES.md`](file:///c:/Users/patri/.gemini/antigravity/playground/passive_income_tracker/DASHBOARD_RULES.md) - Critical implementation rules (MUST READ)
- [`CURRENCY_CONVERSION_RULES.md`](file:///c:/Users/patri/.gemini/antigravity/playground/passive_income_tracker/CURRENCY_CONVERSION_RULES.md) - General currency rules
- [`TABS_SPECIFICATION.md`](file:///c:/Users/patri/.gemini/antigravity/playground/passive_income_tracker/TABS_SPECIFICATION.md) - Other tabs specification

---

## Last Updated
- **Date:** 2026-01-09
- **Status:** ✅ STABLE
- **Validation:** All metrics verified against Tenencia
- **Changes:** Documented complete Dashboard specification with all metrics, charts, and rules
