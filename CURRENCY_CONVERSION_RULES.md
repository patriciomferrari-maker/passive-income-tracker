# Currency Conversion Rules - FINAL VERSION

> [!NOTE]
> For specific tab behavior, see [`TABS_SPECIFICATION.md`](file:///c:/Users/patri/.gemini/antigravity/playground/passive_income_tracker/TABS_SPECIFICATION.md)
> which documents the exact implementation of "Operaciones" and "Flujo por ON" tabs.

> [!CAUTION]
> For Dashboard implementation rules (CRITICAL), see [`DASHBOARD_RULES.md`](file:///c:/Users/patri/.gemini/antigravity/playground/passive_income_tracker/DASHBOARD_RULES.md)
> which contains patterns that have broken multiple times.

> [!IMPORTANT]
> For Dashboard tab complete specification, see [`DASHBOARD_SPECIFICATION.md`](file:///c:/Users/patri/.gemini/antigravity/playground/passive_income_tracker/DASHBOARD_SPECIFICATION.md)
> which documents all metrics, charts, and current behavior.

> [!NOTE]
> For Rentals Dashboard specification, see [`RENTALS_DASHBOARD_SPECIFICATION.md`](file:///c:/Users/patri/.gemini/antigravity/playground/passive_income_tracker/RENTALS_DASHBOARD_SPECIFICATION.md)
> which defines behavior for rental metrics and economic data handling.

> [!TIP]
> For individual rental tabs (Flujo Individual), see [`RENTALS_TABS_SPECIFICATION.md`](file:///c:/Users/patri/.gemini/antigravity/playground/passive_income_tracker/RENTALS_TABS_SPECIFICATION.md).

## Core Principles

### 1. ON Cashflows Are ALWAYS in USD (Database)

> [!IMPORTANT]
> **CRITICAL RULE FOR ONs (Obligaciones Negociables)**:
> - **Database**: Cashflows (intereses y amortizaciones) SIEMPRE se guardan como `currency: 'USD'`
> - **Transacciones**: Se guardan con la moneda en que se compraron (`ARS` o `USD`)
> - **Display**: AMBAS monedas se convierten según la vista seleccionada

**Por qué:** Las ONs argentinas pagan intereses y amortizaciones en USD por contrato, sin importar la moneda de compra.

### 2. Conversión Bidireccional (Display)

**Escenario A: Vista en USD (default)**
- ✅ Cashflows USD → Mostrar USD (sin conversión)
- ✅ Transacciones ARS → Convertir a USD (÷ TC)
- ✅ Transacciones USD → Mostrar USD (sin conversión)

**Escenario B: Vista en ARS**
- ✅ Cashflows USD → Convertir a ARS (× TC)
- ✅ Transacciones ARS → Mostrar ARS (sin conversión)
- ✅ Transacciones USD → Convertir a ARS (× TC)

**Implementación correcta:**
```typescript
// SIEMPRE cargar exchange rates (no importa investment.currency)
const resRates = await fetch('/api/economic-data/tc');
const exchangeRates = processRates(resRates);

// Conversión de cashflows
const convertedCf = dataCf.map(cf => {
    let amount = cf.amount;
    const cfCurrency = cf.currency; // USD para ONs
    
    if (cfCurrency !== viewCurrency) {
        const rate = getRate(cf.date);
        if (cfCurrency === 'ARS' && viewCurrency === 'USD') {
            amount = amount / rate;
        } else if (cfCurrency === 'USD' && viewCurrency === 'ARS') {
            amount = amount * rate; // ← CRÍTICO para vista ARS
        }
    }
    return { ...cf, amount, currency: viewCurrency };
});

// Igual lógica para transacciones
```

### 3. Generación de Cashflows

**Código en `lib/investments.ts`:**
```typescript
// CRITICAL: ONs ALWAYS pay in USD, regardless of purchase currency
const cashflowCurrency = (investment.type === 'ON' || investment.type === 'CORPORATE_BOND') 
    ? 'USD' 
    : investment.currency;

// Usar cashflowCurrency para todos los cashflows generados
cashflow.currency = cashflowCurrency; // USD para ONs
```

### 4. Dashboard Portfolio Breakdown - MUST Normalize to USD

> [!CAUTION]
> **CRITICAL RULE - HAS BROKEN MULTIPLE TIMES**
> 
> All Dashboard calculations MUST normalize transactions to USD BEFORE summing.
> **DO NOT** sum `tx.totalAmount` directly without checking `tx.currency`.

**Common Bug Pattern (WRONG):**
```typescript
// ❌ WRONG - Mixes ARS and USD values
const invested = inv.transactions.reduce((sum, tx) => 
    sum + Math.abs(tx.totalAmount), 0
);
```

**Correct Implementation:**
```typescript
// ✅ CORRECT - Normalizes to USD first
const invested = inv.transactions.reduce((sum, tx) => {
    let txAmount = Math.abs(tx.totalAmount);
    const txCurrency = tx.currency || inv.currency;
    
    // MUST convert ARS to USD
    if (txCurrency === 'ARS') {
        const rate = getExchangeRate(new Date(tx.date));
        txAmount = txAmount / rate;
    }
    
    return sum + txAmount; // Now all in USD
}, 0);
```

**Where This Applies:**
- `app/api/investments/on/dashboard/route.ts`:
  - `portfolioBreakdown` calculation (line ~150)
  - TIR calculation cashflows (line ~157)
  - Any aggregation of transaction amounts

**Why This Breaks:**
- DNC3D transaction: `totalAmount: 9,050,029.58` with `currency: 'ARS'`
- Without conversion: Chart shows "$9,050,029.58" (wrong)
- With conversion: Chart shows "~$6,000" (correct)


**Why:** ONs in Argentina pay interest and amortization in USD by contract, even if purchased with ARS.

**Implementation:**
```typescript
// When generating cashflows for ON/CORPORATE_BOND
if (investment.type === 'ON' || investment.type === 'CORPORATE_BOND') {
    cashflow.currency = 'USD'; // ALWAYS USD, ignore investment.currency
}
```

### 2. ALWAYS Use Actual Currency Fields
- **Cashflows**: Use `cashflow.currency` (NOT `investment.currency`)
- **Transactions**: Use `transaction.currency` (NOT `investment.currency`)
- **Investments**: Use `investment.currency` only when specific field is missing

### 2. Dashboard Data == Tenencia Data
The Dashboard must ALWAYS match Tenencia (Positions) for these metrics:

| Metric | Dashboard Field | Tenencia Calculation | Status |
|--------|----------------|----------------------|---------|
| Inversión Total | `capitalInvertido` | `Σ(quantity * buyPrice + buyCommission)` | ✅ Validated |
| Valor Actual | `totalCurrentValue` | `Σ(quantity * sellPrice)` | ✅ Validated |

### 3. Conversion Logic

```typescript
// CORRECT: Check actual currency field
if (cashflow.currency !== viewCurrency) {
    const rate = getExchangeRate(cashflow.date);
    if (cashflow.currency === 'ARS' && viewCurrency === 'USD') {
        amount = amount / rate;
    } else if (cashflow.currency === 'USD' && viewCurrency === 'ARS') {
        amount = amount * rate;
    }
}

// WRONG: Don't assume investment currency
if (investment.currency !== viewCurrency) { // ❌ WRONG
    // This breaks when cashflow.currency differs from investment.currency
}
```

### 4. Price Normalization for Bonds

Follow this sequence for ON/CORPORATE_BOND prices:

1. **Convert raw price to USD** (if needed)
   ```typescript
   if (investment.currency === 'ARS') {
       priceUSD = rawPrice / currentExchangeRate;
   }
   ```

2. **Apply bond heuristic** (divide by 100 if > 2.0)
   ```typescript
   if (priceUSD > 2.0) {
       priceUSD = priceUSD / 100;
   }
   ```

3. **Use this normalized price** for all calculations

## Validation

### Automated Endpoint
```
GET /api/investments/on/validate
```

Returns:
```json
{
  "isValid": true,
  "checks": [
    {
      "name": "Inversión Total (Dashboard vs Tenencia)",
      "expected": 12345.67,
      "actual": 12345.67,
      "diff": 0.00,
      "passed": true
    },
    {
      "name": "ON Cashflows in USD",
      "expected": "All ON/CORPORATE_BOND cashflows should have currency=USD",
      "actual": "All valid",
      "passed": true
    }
  ],
  "warnings": []
}
```

**If validation fails for ON cashflows:**
Run the fix script:
```bash
npx ts-node scripts/fix-on-currencies.ts
```

### Manual Testing Checklist

- [ ] Dashboard "Inversión Total" == Tenencia total "Valor Compra" (USD)
- [ ] Dashboard "Valor Actual" == Tenencia total "Valor Actual" (USD)
- [ ] Operaciones tab converts correctly when switching ARS/USD
- [ ] Flujo por ON shows correct amounts based on cashflow.currency
- [ ] DNC3D (ARS investment with USD cashflows) displays correctly

## Common Pitfalls to Avoid

1. ❌ **Don't assume investment.currency for cashflows**
   - DNC3D has `investment.currency='ARS'` but `cashflow.currency='USD'`

2. ❌ **Don't double-convert values**
   - If `currentPrice` is already in USD, don't divide by exchange rate again

3. ❌ **Don't use wrong exchange rate date**
   - Historical transactions: use `getExchangeRate(transaction.date)`
   - Future cashflows: use `getExchangeRate(new Date())`

4. ❌ **Don't skip bond price heuristic**
   - Always check if USD price > 2.0, then divide by 100

## Files to Review for Changes

| File | Purpose | Key Function |
|------|---------|-------------|
| `app/api/investments/on/dashboard/route.ts` | Dashboard calculations | Dashboard totals must match Positions API |
| `app/api/investments/positions/route.ts` | Source of truth for positions | Price normalization reference |
| `components/on/IndividualCashflowTab.tsx` | Flujo por ON | Use `cashflow.currency` for conversion |
| `components/on/PurchasesTab.tsx` | Operations currency toggle | Use `transaction.currency` for conversion |

## Emergency Rollback

If validation fails:
1. Check `/api/investments/on/validate` endpoint
2. Compare Dashboard vs Tenencia in browser
3. Review recent changes to files listed above
4. Revert to last known good commit

## Future Enhancements

- [ ] Add automated tests for currency conversion
- [ ] Create dashboard widget showing validation status
- [ ] Add alerting if validation fails
- [ ] Implement health check endpoint
