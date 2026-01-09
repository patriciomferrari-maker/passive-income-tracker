# Currency Conversion Rules

## Core Principles

### 1. ALWAYS Use Actual Currency Fields
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
    }
  ],
  "warnings": []
}
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
