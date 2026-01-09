# Cartera Argentina - Tabs Specification

> [!CAUTION]
> **CRITICAL REFERENCE DOCUMENT**
> This document defines the EXACT behavior of the "Operaciones" and "Flujo por ON" tabs.
> DO NOT modify these tabs without:
> 1. Asking the user for approval
> 2. Updating this specification document
> 3. Adding validation checks if applicable

---

## Tab 1: Operaciones (Purchases Tab)

**Purpose:** Display all buy/sell transactions for ONs, CEDEARs, and ETFs with currency conversion capability.

### Current Implementation
- **File:** `components/on/PurchasesTab.tsx`
- **API Dependency:** `/api/investments/transactions`
- **Exchange Rates API:** `/api/economic-data/tc`

### Features

#### 1. Currency Toggle (ARS/USD)
- **Default:** USD
- **Location:** Top-right corner of card header
- **Behavior:** 
  - Loads exchange rates on every fetch
  - Converts ALL transaction amounts (totalAmount, price, commission) based on `transaction.currency`
  - Re-fetches data when currency changes

#### 2. Auto-Expanded Operations
- **Behavior:** All asset groups (tickers) are expanded by default on load
- **Implementation:** `setExpandedTickers(uniqueTickers)` after fetch

#### 3. Currency Conversion Logic

```typescript
// Conversion happens in fetchTransactions()
const convertedData = data.map((tx: Transaction) => {
    const txCurrency = tx.currency || 'USD';
    let totalAmount = tx.totalAmount;
    let price = tx.price;
    let commission = tx.commission;

    if (txCurrency !== viewCurrency) {
        const rate = getRate(tx.date);
        if (txCurrency === 'ARS' && viewCurrency === 'USD') {
            totalAmount = totalAmount / rate;
            price = price / rate;
            commission = commission / rate;
        } else if (txCurrency === 'USD' && viewCurrency === 'ARS') {
            totalAmount = totalAmount * rate;
            price = price * rate;
            commission = commission * rate;
        }
    }

    return { ...tx, totalAmount, price, commission, currency: viewCurrency };
});
```

#### 4. Display Columns
- **Fecha:** Transaction date
- **Tipo:** BUY/SELL
- **Cantidad:** Number of units
- **Precio:** Price per unit (converted)
- **Comisión:** Commission amount (converted)
- **Total:** Total transaction amount (converted)
- **Moneda:** Display currency (ARS or USD)
- **Acciones:** Edit/Delete buttons

### Validation Rules
- ✅ Toggle must exist and be functional
- ✅ All groups expanded by default
- ✅ Currency conversion bidirectional (ARS↔USD)
- ✅ Exchange rates loaded on every fetch

---

## Tab 2: Flujo por ON (Individual Cashflow Tab)

**Purpose:** Display detailed cashflow breakdown for a single ON/CEDEAR, including purchase transaction, interests, and amortizations.

### Current Implementation
- **File:** `components/on/IndividualCashflowTab.tsx`
- **API Dependencies:**
  - `/api/investments/on/[id]` - Investment details
  - `/api/investments/on/[id]/cashflows` - Cashflows
  - `/api/investments/on/[id]/transactions` - Transactions
  - `/api/economic-data/tc` - Exchange rates

### Features

#### 1. Currency Toggle (ARS/USD)
- **Default:** USD
- **Location:** Top-right corner of card header
- **Behavior:**
  - ALWAYS loads exchange rates (regardless of investment.currency)
  - Converts cashflows based on `cashflow.currency`
  - Converts transactions based on `transaction.currency`
  - Re-loads data when currency changes

#### 2. Data Types Displayed
1. **Compra (Purchase):** Initial transaction(s)
   - Shows: Date, Concept, Amount (converted), Saldo Nominales
   - Badge: Purple "COMPRA"

2. **Interés (Interest):** Interest payment cashflows
   - Shows: Date, Concept (% VR), Amount (converted), Saldo Nominales
   - Badge: Green "INTERÉS"
   - **Database:** Always `currency: 'USD'`

3. **Amortización (Amortization):** Capital repayment cashflows
   - Shows: Date, Concept (%), Amount (converted), Saldo Nominales
   - Badge: Blue "AMORTIZACIÓN"
   - **Database:** Always `currency: 'USD'`

#### 3. Currency Conversion Logic - CRITICAL

**Key Rule:** ALWAYS load exchange rates, don't check `investment.currency`

```typescript
// ALWAYS load Exchange Rates (cashflows may have different currency than investment)
const resRates = await fetch('/api/economic-data/tc');
const ratesData = await resRates.json();
const exchangeRates: Record<string, number> = {};
ratesData.forEach((r: any) => {
    const dateKey = new Date(r.date).toISOString().split('T')[0];
    exchangeRates[dateKey] = r.value;
});

// Convert cashflows based on cashflow.currency (NOT investment.currency)
const convertedCf = dataCf.map((cf: any) => {
    let amount = cf.amount;
    const cfCurrency = cf.currency || investmentCurrency;
    
    if (cfCurrency !== viewCurrency && amount !== 0) {
        const rate = getRate(cf.date);
        if (cfCurrency === 'ARS' && viewCurrency === 'USD') {
            amount = amount / rate;
        } else if (cfCurrency === 'USD' && viewCurrency === 'ARS') {
            amount = amount * rate; // CRITICAL for ARS view
        }
    }
    return { ...cf, amount, currency: viewCurrency };
});

// Convert transactions based on transaction.currency
const convertedTx = dataTx.map((tx: any) => {
    let totalAmount = tx.totalAmount;
    let price = tx.price;
    const txCurrency = tx.currency || investmentCurrency;

    if (txCurrency !== viewCurrency) {
        const rate = getRate(tx.date);
        if (txCurrency === 'ARS' && viewCurrency === 'USD') {
            totalAmount = totalAmount / rate;
            price = price / rate;
        } else if (txCurrency === 'USD' && viewCurrency === 'ARS') {
            totalAmount = totalAmount * rate;
            price = price * rate;
        }
    }
    return { ...tx, totalAmount, price, currency: viewCurrency };
});
```

#### 4. Example: DNC3D (Purchased in ARS)

**Database State:**
- `investment.currency = 'ARS'`
- `transaction.currency = 'ARS'` (purchase)
- `cashflow.currency = 'USD'` (all interest/amortization)

**View USD (default):**
- ❌ Compra: -7,540.72 ARS → **÷ 1,503 = -5.02 USD** ✓
- ✓ Interés: 0.19 USD → **0.19 USD** (no conversion)
- ✓ Amortización: 3.89 USD → **3.89 USD** (no conversion)

**View ARS:**
- ✓ Compra: -7,540.72 ARS → **-7,540.72 ARS** (no conversion)
- ❌ Interés: 0.19 USD → **× 1,505 = 285.95 ARS** ✓
- ❌ Amortización: 3.89 USD → **× 1,505 = 5,854.45 ARS** ✓

### Validation Rules
- ✅ Toggle must exist and be functional
- ✅ Exchange rates ALWAYS loaded (not conditional)
- ✅ Cashflows converted based on `cashflow.currency`
- ✅ Transactions converted based on `transaction.currency`
- ✅ All ON cashflows must be in USD in database
- ✅ Bidirectional conversion (ARS↔USD)

---

## Change Management Protocol

> [!WARNING]
> **MANDATORY PROCESS FOR FUTURE CHANGES**

Before making ANY changes to "Operaciones" or "Flujo por ON" tabs:

### 1. Ask User
- ❓ "This change would modify [describe behavior]. Should I update the specification document?"

### 2. Update Documentation
If approved, update:
- [ ] This specification document (`TABS_SPECIFICATION.md`)
- [ ] Currency conversion rules (`CURRENCY_CONVERSION_RULES.md`)
- [ ] Add test case to validation endpoint if applicable

### 3. Validate Change
Run after deployment:
```bash
# Check data consistency
curl http://localhost:3000/api/investments/on/validate

# Manual check
1. Open "Operaciones" → Toggle ARS/USD → Verify all amounts convert
2. Open "Flujo por ON" → Select ON → Toggle ARS/USD → Verify all convert
3. Check console logs for conversion details
```

### 4. Document in Commit
Include in commit message:
```
feat(tabs): [description]

- Updated behavior: [what changed]
- Spec updated: YES
- Validation added: [YES/NO]

Resolves: [issue or user request]
```

---

## Debug Logging

Both tabs include console logging for debugging:

**Operaciones:**
- Transaction count after fetch
- Currency conversion details (if implemented)

**Flujo por ON:**
```javascript
console.log('Loading data for ${ticker}, Investment Currency: ${inv.currency}, View Currency: ${viewCurrency}');
console.log('🔍 CASHFLOW DEBUG:');
console.log('First 3 cashflows:', dataCf.slice(0, 3));
console.log('CF: ${type} | DB: ${cf.currency} | Resolved: ${cfCurrency} | View: ${viewCurrency}');
console.log('Converted: ${originalAmount} ${cfCurrency} → ${amount} ${viewCurrency} (rate: ${rate})');
```

---

## Related Files

- `components/on/PurchasesTab.tsx` - Operaciones implementation
- `components/on/IndividualCashflowTab.tsx` - Flujo por ON implementation
- `app/api/economic-data/tc/route.ts` - Exchange rates API
- `CURRENCY_CONVERSION_RULES.md` - General conversion rules
- `scripts/fix-on-currencies.ts` - Fix script for currency mismatches

---

## Last Updated
- **Date:** 2026-01-09
- **Reason:** Initial specification documentation
- **Status:** ✅ STABLE - Do not modify without approval
