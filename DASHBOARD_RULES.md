# Dashboard Implementation Rules

> [!CAUTION]
> **CRITICAL REFERENCE - READ BEFORE MODIFYING DASHBOARD**
> 
> This document contains rules that have broken multiple times.
> All Dashboard calculations MUST follow these patterns.

---

## Rule 1: Always Normalize Transactions to USD

### The Problem
Transactions can be in ARS or USD. If you sum `tx.totalAmount` directly without checking `tx.currency`, you'll mix currencies and get incorrect totals.

### Examples of Breakage

**Bug Instance #1 - Portfolio Breakdown Chart**
```typescript
// ❌ WRONG - This broke on 2026-01-09
const invested = inv.transactions.reduce((sum, tx) => 
    sum + Math.abs(tx.totalAmount), 0
);
// Result: DNC3D shows $9,050,029.58 (ARS value, not converted)
```

**Bug Instance #2 - TIR Calculation**
```typescript
// ❌ WRONG - Cashflows in USD mixed with transactions in ARS
amounts.push(-Math.abs(tx.totalAmount)); // Might be ARS
amounts.push(cf.amount); // Always USD for ONs
// Result: Invalid TIR calculation
```

### Correct Implementation

**Pattern to ALWAYS Use:**
```typescript
// ✅ CORRECT - Normalize before using
const invested = inv.transactions.reduce((sum, tx) => {
    let txAmount = Math.abs(tx.totalAmount);
    const txCurrency = tx.currency || inv.currency;
    
    // MUST convert ARS to USD at historical rate
    if (txCurrency === 'ARS') {
        const rate = getExchangeRate(new Date(tx.date));
        txAmount = txAmount / rate;
    }
    
    return sum + txAmount; // All values now in USD
}, 0);
```

### Where to Apply

In `app/api/investments/on/dashboard/route.ts`:

1. **Portfolio Breakdown** (line ~150):
   ```typescript
   const portfolioBreakdown = investments.map(inv => {
       // Calculate invested - NORMALIZE ALL TO USD
       const invested = inv.transactions.reduce((sum, tx) => {
           // ... conversion logic ...
       }, 0);
   });
   ```

2. **TIR Calculation** (line ~157):
   ```typescript
   inv.transactions.forEach(tx => {
       let txAmount = Math.abs(tx.totalAmount);
       const txCurrency = tx.currency || inv.currency;
       
       if (txCurrency === 'ARS') {
           const rate = getExchangeRate(new Date(tx.date));
           txAmount = txAmount / rate;
       }
       
       amounts.push(-txAmount);
   });
   ```

3. **Any Other Aggregation**:
   ```typescript
   // If you're summing, averaging, or calculating with transaction amounts:
   // 1. Check tx.currency
   // 2. Convert if ARS
   // 3. Then use value
   ```

---

## Rule 2: Dashboard Values Must Match Tenencia

The Dashboard internally calls the Positions API to get authoritative values:

```typescript
// In dashboard route.ts
const positionsUrl = new URL('/api/investments/positions', request.url);
positionsUrl.searchParams.set('market', 'ARG');
positionsUrl.searchParams.set('currency', 'USD');
const positionsRes = await fetch(positionsUrl.toString(), {
    headers: { cookie: request.headers.get('cookie') || '' }
});
const positions = await positionsRes.json();

// Use these as source of truth
const capitalInvertido = positions.reduce((sum, p) => 
    sum + (p.quantity * p.buyPrice + p.buyCommission), 0
);
const totalCurrentValue = positions.reduce((sum, p) => 
    sum + (p.quantity * (p.sellPrice || 0)), 0
);
```

**Validation Endpoint:**
```
GET /api/investments/on/validate
```

This endpoint checks:
- ✅ Dashboard `capitalInvertido` == Tenencia total
- ✅ Dashboard `totalCurrentValue` == Tenencia total
- ✅ All ON cashflows are in USD

---

## Rule 3: Exchange Rate Helper Must Be Available

The Dashboard uses `getExchangeRate()` helper for conversions:

```typescript
// Helper function (should exist in dashboard route)
const getExchangeRate = (date: Date): number => {
    if (!rates || rates.length === 0) return 1;
    const dateStr = date.toISOString().split('T')[0];
    
    // Find exact match
    const exactMatch = rates.find(r => 
        new Date(r.date).toISOString().split('T')[0] === dateStr
    );
    if (exactMatch) return exactMatch.value;
    
    // Find closest past date
    const pastRates = rates
        .filter(r => new Date(r.date) <= date)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    return pastRates.length > 0 ? pastRates[0].value : 1200; // Fallback
};
```

**Ensure:**
- `rates` are loaded at the start: 
  ```typescript
  const rates = await prisma.economicIndicator.findMany({
      where: { type: 'TC_USD_ARS' },
      orderBy: { date: 'asc' }
  });
  ```

---

## Rule 4: TIR Consolidada Must Use Cashflow Currency

### The Problem
TIR consolidada calculation was using `investment.currency` to decide whether to convert cashflows, but ON cashflows are stored as `currency: 'USD'` regardless of `investment.currency`.

### Example of Breakage

**Bug Instance #3 - TIR Consolidada (2026-01-09)**
```typescript
// ❌ WRONG - Uses investment.currency instead of cashflow.currency
inv.cashflows.forEach(cf => {
    let amount = cf.amount;
    if (inv.currency === 'ARS') {  // WRONG! Cashflow might be USD
        amount = amount / rate;     // Divides USD by 1500 = wrong
    }
    allAmounts.push(amount);
});
// Result: TIR shows 0% because cashflow amounts are incorrect
```

### Correct Implementation

```typescript
// ✅ CORRECT - Check cashflow's actual currency
inv.cashflows.forEach(cf => {
    let amount = cf.amount;
    const cfCurrency = cf.currency || inv.currency;
    
    // Only convert if cashflow itself is in ARS
    if (cfCurrency === 'ARS') {
        const cfDate = new Date(cf.date);
        const rate = cfDate <= new Date() 
            ? getExchangeRate(cfDate) 
            : getExchangeRate(new Date());
        if (rate > 0) amount = amount / rate;
    }
    // If cfCurrency is USD, don't convert (already in USD)
    
    allAmounts.push(amount);
    allDates.push(new Date(cf.date));
});
```

### Where This Applies

In `app/api/investments/on/dashboard/route.ts`:

**TIR Consolidada Calculation** (line ~227):
- When building `allAmounts` array for XIRR
- Must check `cf.currency` not `inv.currency`
- Both transactions AND cashflows must be normalized to USD

### Pattern Summary

**For any TIR or XIRR calculation:**
1. ✅ Convert transactions using `tx.currency`
2. ✅ Convert cashflows using `cf.currency`
3. ❌ NEVER use `inv.currency` to decide conversion
4. ✅ Ensure all amounts in same currency before XIRR

---

## Checklist Before Modifying Dashboard

- [ ] Am I aggregating transaction amounts?
- [ ] Did I check `tx.currency` before using `tx.totalAmount`?
- [ ] Did I convert ARS to USD using `getExchangeRate(tx.date)`?
- [ ] Am I calculating TIR/XIRR with cashflows?
- [ ] Did I check `cf.currency` before using `cf.amount`?
- [ ] Did I avoid using `inv.currency` to decide conversions?
- [ ] Did I test with a transaction in ARS (e.g., DNC3D)?
- [ ] Did I run `/api/investments/on/validate` after changes?
- [ ] Do Dashboard totals match Tenencia tab?
- [ ] Is TIR consolidada showing a reasonable value (not 0%, not NULL)?


---

## Test Cases

### Test Case 1: Portfolio Breakdown Chart
**Setup:**
- DNC3D: 1 transaction at $9,050,029.58 ARS on 2026-01-05 (rate ~1505)
- DNC5D: 1 transaction at $5,000 USD

**Expected Result:**
```json
{
  "portfolioBreakdown": [
    {
      "ticker": "DNC3D",
      "invested": 6013.31  // 9050029.58 / 1505 = ~6013
    },
    {
      "ticker": "DNC5D", 
      "invested": 5000.00  // Already USD
    }
  ]
}
```

**How to Verify:**
1. Open Dashboard
2. Check "Composición del Portfolio" chart
3. Hover over DNC3D slice
4. Should show ~$6,013 USD (NOT $9,050,029)

### Test Case 2: Validation Endpoint
```bash
curl http://localhost:3000/api/investments/on/validate

# Should return:
{
  "isValid": true,
  "checks": [
    { "name": "Inversión Total", "passed": true },
    { "name": "Valor Actual", "passed": true },
    { "name": "ON Cashflows in USD", "passed": true }
  ]
}
```

---

## Common Mistakes

### Mistake 1: Assuming All Transactions Are USD
```typescript
// ❌ WRONG
const total = transactions.reduce((sum, tx) => sum + tx.totalAmount, 0);
```

### Mistake 2: Not Using Historical Rate
```typescript
// ❌ WRONG - Uses current rate for past transaction
const currentRate = 1500;
const usdAmount = arsAmount / currentRate; 
```

### Mistake 3: Converting Already-USD Cashflows
```typescript
// ❌ WRONG - ONs cashflows are already USD
inv.cashflows.forEach(cf => {
    const usdAmount = cf.amount / rate; // Don't divide USD by rate!
});
```

### Mistake 4: Using investment.currency Instead of Actual Currency
```typescript
// ❌ WRONG - investment.currency doesn't tell you cashflow currency
if (inv.currency === 'ARS') {
    cfAmount = cfAmount / rate; // Might divide USD by rate!
}

// ✅ CORRECT - Use actual currency field
const cfCurrency = cf.currency || inv.currency;
if (cfCurrency === 'ARS') {
    cfAmount = cfAmount / rate;
}
```

---

## Emergency Rollback

If Dashboard shows incorrect values:

1. **Check validation:**
   ```bash
   curl https://your-app.vercel.app/api/investments/on/validate
   ```

2. **Compare with Tenencia:**
   - Open Tenencia tab
   - Note "Total Inversión" and "Valor Actual"
   - These are SOURCE OF TRUTH

3. **Review recent changes to:**
   - `app/api/investments/on/dashboard/route.ts`
   - Look for lines with `tx.totalAmount` or `.reduce()`
   - Ensure all have currency conversion

4. **Revert if needed:**
   ```bash
   git log --oneline app/api/investments/on/dashboard/route.ts
   git revert <commit-hash>
   ```

---

## Last Updated
- **Date:** 2026-01-09
- **Reason:** Multiple currency conversion bugs fixed
- **Fixes Applied:**
  1. Portfolio breakdown showing mixed ARS/USD (line ~150)
  2. TIR individual calculations mixing currencies (line ~157)
  3. TIR consolidada using inv.currency instead of cf.currency (line ~227)
- **Status:** All three instances now use correct currency fields

