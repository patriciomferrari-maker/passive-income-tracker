

export interface FIFOTransaction {
    id?: string;
    date: Date;
    type: 'BUY' | 'SELL';
    quantity: number; // Always positive
    price: number;
    currency: string;
    commission?: number;
    createdAt?: Date; // Secondary sort key
    // New fields for P&L Attribution
    exchangeRate?: number; // TC at moment of transaction
    originalPrice?: number; // Original price in original currency (if converted)
}

export interface RealizedGainEvent {
    id: string; // Unique ID
    date: Date; // Sale Date
    ticker: string;
    status: 'CLOSED'; // Explicit status
    quantity: number;
    sellPrice: number;
    sellCommission: number; // Prorated or distinct? For now, we assume sales have their own commission
    buyPriceAvg: number; // Weighted average cost basis
    buyCommissionPaid: number; // Prorated commission from the buy lots
    gainAbs: number;
    gainPercent: number;
    currency: string;
    // New fields
    buyExchangeRateAvg?: number;
}

export interface OpenPositionEvent {
    id: string; // Unique ID
    date: Date; // Purchase Date
    ticker: string;
    status: 'OPEN';
    quantity: number;
    buyPrice: number;
    buyCommission: number; // Prorated if it was a partial lot, or full if whole
    currency: string;
    originalTotalQty?: number; // Helper to know if it was comprised of larger lot?
    // New fields
    buyExchangeRateAvg?: number;
    buyPriceOriginalAvg?: number; // Weighted avg of original price (USD)
}

export type PositionEvent = RealizedGainEvent | OpenPositionEvent;

export interface FIFOResult {
    inventory: FIFOTransaction[]; // Raw remaining inventory
    openPositions: OpenPositionEvent[]; // Formatted open lots
    realizedGains: RealizedGainEvent[]; // Closed lots
    totalGainAbs: number;
}

/**
 * Calculates Realized Gains using First-In-First-Out (FIFO) method.
 * Assumes transactions are for a SINGLE asset (ticker).
 */
export function calculateFIFO(transactions: FIFOTransaction[], ticker: string): FIFOResult {
    // 1. Sort by date ASC, then by createdAt ASC
    const sorted = [...transactions]
        .map(tx => ({
            ...tx,
            price: Number(tx.price),
            quantity: Number(tx.quantity),
            commission: Number(tx.commission || 0)
        }))
        .filter(tx => !isNaN(tx.price) && !isNaN(tx.quantity) && tx.quantity > 0)
        .sort((a, b) => {
            const dateDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
            if (dateDiff !== 0) return dateDiff;

            // Secondary sort: createdAt
            if (a.createdAt && b.createdAt) {
                return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
            }
            return 0;
        });

    // Inventory items now need to track their specific commission paid AND exchange rates
    interface InventoryItem extends FIFOTransaction {
        originalCommission: number; // Total commission paid for the original batch
        originalQuantity: number; // Total quantity of the original batch
        originalExchangeRate: number; // TC at buy
        originalUnitCostOriginalCurrency: number; // Price in orig currency
    }

    const inventory: InventoryItem[] = [];
    const realizedGains: RealizedGainEvent[] = [];
    let totalGainAbs = 0;

    for (const tx of sorted) {
        if (tx.type === 'BUY') {
            // Add to inventory
            inventory.push({
                ...tx,
                originalCommission: tx.commission || 0,
                originalQuantity: tx.quantity,
                originalExchangeRate: tx.exchangeRate || 1,
                originalUnitCostOriginalCurrency: tx.originalPrice || tx.price
            });
        } else if (tx.type === 'SELL') {
            let qtyToSell = tx.quantity;
            let costBasisTotal = 0;
            let buyCommissionConsumedTotal = 0;
            let qtySoldTotal = 0;

            // For weighted avg tracking of consumed lots
            let totalWeightedExchangeRate = 0;
            let totalWeightedOriginalPrice = 0;

            // Consume inventory FIFO
            while (qtyToSell > 0 && inventory.length > 0) {
                const batch = inventory[0]; // Peek first (oldest)

                if (batch.quantity <= qtyToSell) {
                    // Fully consume this batch
                    const batchCost = batch.quantity * batch.price;

                    // Prorate commission: (BatchCurrentQty / BatchOriginalQty) * BatchOriginalCommission
                    const proratedComm = batch.originalQuantity > 0
                        ? (batch.quantity / batch.originalQuantity) * batch.originalCommission
                        : 0;

                    costBasisTotal += batchCost;
                    buyCommissionConsumedTotal += proratedComm;
                    qtySoldTotal += batch.quantity;

                    // accumulate weighted sums
                    totalWeightedExchangeRate += batch.quantity * batch.originalExchangeRate;
                    // totalWeightedOriginalPrice += batch.quantity * batch.originalUnitCostOriginalCurrency;

                    qtyToSell -= batch.quantity;
                    inventory.shift(); // Remove from queue
                } else {
                    // Partially consume this batch
                    const qtyConsumed = qtyToSell;
                    const batchCost = qtyConsumed * batch.price;
                    const proratedComm = batch.originalQuantity > 0
                        ? (qtyConsumed / batch.originalQuantity) * batch.originalCommission
                        : 0;

                    costBasisTotal += batchCost;
                    buyCommissionConsumedTotal += proratedComm;
                    qtySoldTotal += qtyConsumed;

                    // accumulate weighted sums
                    totalWeightedExchangeRate += qtyConsumed * batch.originalExchangeRate;
                    // totalWeightedOriginalPrice += qtyConsumed * batch.originalUnitCostOriginalCurrency;

                    batch.quantity -= qtyConsumed; // Reduce remaining qty
                    qtyToSell = 0;
                }
            }

            // Record Gain
            if (qtySoldTotal > 0) {
                const sellCommission = tx.commission || 0;
                const totalSellProceedsNet = (qtySoldTotal * tx.price) - sellCommission;
                const totalBuyCostFirst = costBasisTotal + buyCommissionConsumedTotal;
                const gainAbs = totalSellProceedsNet - totalBuyCostFirst;
                const gainPercent = totalBuyCostFirst !== 0 ? (gainAbs / totalBuyCostFirst) * 100 : 0;

                const buyPriceAvg = costBasisTotal / qtySoldTotal;
                const buyExchangeRateAvg = totalWeightedExchangeRate / qtySoldTotal;

                realizedGains.push({
                    id: tx.id || `gain-${tx.date.getTime()}-${Math.random()}`,
                    date: tx.date,
                    ticker,
                    status: 'CLOSED',
                    quantity: qtySoldTotal,
                    sellPrice: tx.price,
                    sellCommission: sellCommission,
                    buyPriceAvg: isNaN(buyPriceAvg) ? 0 : buyPriceAvg,
                    buyCommissionPaid: buyCommissionConsumedTotal || 0,
                    gainAbs,
                    gainPercent: isNaN(gainPercent) ? 0 : gainPercent,
                    currency: tx.currency,
                    buyExchangeRateAvg: isNaN(buyExchangeRateAvg) ? 1 : buyExchangeRateAvg
                });

                totalGainAbs += gainAbs;
            }
        }
    }

    // Process Open Positions
    const openPositions: OpenPositionEvent[] = inventory.map(item => {
        const proratedComm = item.originalQuantity > 0
            ? (item.quantity / item.originalQuantity) * item.originalCommission
            : 0;

        return {
            id: item.id || `open-${item.date.getTime()}-${Math.random()}`,
            date: item.date,
            ticker,
            status: 'OPEN',
            quantity: item.quantity,
            buyPrice: item.price,
            buyCommission: proratedComm,
            currency: item.currency,
            originalTotalQty: item.originalQuantity,
            buyExchangeRateAvg: item.originalExchangeRate, // For a single lot, avg is itself
            buyPriceOriginalAvg: item.originalUnitCostOriginalCurrency
        };
    });


    return { inventory, openPositions, realizedGains, totalGainAbs };
}
