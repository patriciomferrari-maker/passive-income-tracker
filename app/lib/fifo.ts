
export interface FIFOTransaction {
    id?: string;
    date: Date;
    type: 'BUY' | 'SELL';
    quantity: number; // Always positive
    price: number;
    currency: string;
    commission?: number;
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
    // 1. Sort by date ASC
    const sorted = [...transactions]
        .map(tx => ({
            ...tx,
            price: Number(tx.price),
            quantity: Number(tx.quantity),
            commission: Number(tx.commission || 0)
        }))
        .filter(tx => !isNaN(tx.price) && !isNaN(tx.quantity) && tx.quantity > 0)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Inventory items now need to track their specific commission paid
    interface InventoryItem extends FIFOTransaction {
        originalCommission: number; // Total commission paid for the original batch
        originalQuantity: number; // Total quantity of the original batch
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
                originalQuantity: tx.quantity
            });
        } else if (tx.type === 'SELL') {
            let qtyToSell = tx.quantity;
            let costBasisTotal = 0;
            let buyCommissionConsumedTotal = 0;
            let qtySoldTotal = 0;

            // Consume inventory FIFO
            while (qtyToSell > 0 && inventory.length > 0) {
                const batch = inventory[0]; // Peek first (oldest)

                if (batch.quantity <= qtyToSell) {
                    // Fully consume this batch
                    const batchCost = batch.quantity * batch.price;

                    // Prorate commission: (BatchCurrentQty / BatchOriginalQty) * BatchOriginalCommission
                    // Since we are consuming the *rest* of the batch (current quantity), we take the proportional commission remaining?
                    // Simpler: We tracked the "unit commission" or we just re-calculate prorated.
                    // Prorated Comm = (QtyConsumed / OriginalQty) * OriginalComm
                    const proratedComm = batch.originalQuantity > 0
                        ? (batch.quantity / batch.originalQuantity) * batch.originalCommission
                        : 0;

                    costBasisTotal += batchCost;
                    buyCommissionConsumedTotal += proratedComm;
                    qtySoldTotal += batch.quantity;
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

                    batch.quantity -= qtyConsumed; // Reduce remaining qty
                    qtyToSell = 0;
                }
            }

            // Record Gain
            if (qtySoldTotal > 0) {
                // Sell Commission: We assume the TX commission is for the WHOLE sale. 
                // Since this logic processes one SELL tx at a time (which might consume multiple BUY lots),
                // the sell commission is fully attributed to this realization event.
                const sellCommission = tx.commission || 0;

                // Result = (SellAmount - SellComm) - (BuyAmount + BuyComm)
                // SellAmount = SellPrice * Qty
                // BuyAmount = CostBasisTotal

                const totalSellProceedsNet = (qtySoldTotal * tx.price) - sellCommission;
                const totalBuyCostFirst = costBasisTotal + buyCommissionConsumedTotal;

                const gainAbs = totalSellProceedsNet - totalBuyCostFirst;
                // ROI % = Profit / Invested
                const gainPercent = totalBuyCostFirst !== 0 ? (gainAbs / totalBuyCostFirst) * 100 : 0;

                const buyPriceAvg = qtySoldTotal > 0 ? costBasisTotal / qtySoldTotal : 0;

                // Safety check for NaN
                const safeBuyPriceAvg = isNaN(buyPriceAvg) ? 0 : buyPriceAvg;
                const safeGainPercent = isNaN(gainPercent) ? 0 : gainPercent;

                realizedGains.push({
                    id: tx.id || `gain-${tx.date.getTime()}-${Math.random()}`,
                    date: tx.date,
                    ticker,
                    status: 'CLOSED',
                    quantity: qtySoldTotal,
                    sellPrice: tx.price,
                    sellCommission: sellCommission,
                    buyPriceAvg: safeBuyPriceAvg,
                    buyCommissionPaid: buyCommissionConsumedTotal || 0, // Prevent NaN
                    gainAbs,
                    gainPercent: safeGainPercent,
                    currency: tx.currency
                });

                totalGainAbs += gainAbs;
            }
        }
    }

    // Process Open Positions from remaining Inventory
    const openPositions: OpenPositionEvent[] = inventory.map(item => {
        // Prorated commission for the remaining quantity
        // Prorated commission for the remaining quantity
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
            originalTotalQty: item.originalQuantity
        };
    });

    return { inventory, openPositions, realizedGains, totalGainAbs };
}
