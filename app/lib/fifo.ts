
export interface FIFOTransaction {
    id?: string;
    date: Date;
    type: 'BUY' | 'SELL';
    quantity: number;
    price: number;
    currency: string;
    commission?: number;
}

export interface RealizedGainEvent {
    id: string; // Unique ID for keying (composed)
    date: Date;
    ticker: string;
    quantity: number;
    sellPrice: number;
    buyPriceAvg: number; // Weighted average of the lots sold
    gainAbs: number;
    gainPercent: number;
    currency: string;
}

export interface FIFOResult {
    inventory: FIFOTransaction[]; // Remaining open positions
    realizedGains: RealizedGainEvent[];
    totalGainAbs: number;
}

/**
 * Calculates Realized Gains using First-In-First-Out (FIFO) method.
 * Assumes transactions are for a SINGLE asset (ticker).
 */
export function calculateFIFO(transactions: FIFOTransaction[], ticker: string): FIFOResult {
    // 1. Sort by date ASC
    const sorted = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const inventory: FIFOTransaction[] = [];
    const realizedGains: RealizedGainEvent[] = [];
    let totalGainAbs = 0;

    for (const tx of sorted) {
        if (tx.type === 'BUY') {
            // Add to inventory
            inventory.push({ ...tx });
        } else if (tx.type === 'SELL') {
            let qtyToSell = tx.quantity;
            let costBasisTotal = 0;
            let qtySoldTotal = 0;

            // Consume inventory FIFO
            while (qtyToSell > 0 && inventory.length > 0) {
                const batch = inventory[0]; // Peek first (oldest)

                if (batch.quantity <= qtyToSell) {
                    // Fully consume this batch
                    costBasisTotal += batch.quantity * batch.price;
                    qtySoldTotal += batch.quantity;
                    qtyToSell -= batch.quantity;
                    inventory.shift(); // Remove from queue
                } else {
                    // Partially consume this batch
                    costBasisTotal += qtyToSell * batch.price;
                    qtySoldTotal += qtyToSell;
                    batch.quantity -= qtyToSell;
                    qtyToSell = 0;
                    // Batch remains in queue with reduced quantity
                }
            }

            // Only record gain if we actually sold something (sanity check)
            if (qtySoldTotal > 0) {
                const totalSaleProceeds = (qtySoldTotal * tx.price) - (tx.commission || 0); // Net of sell commission? 
                // Note: Standard accounting usually deducts commission from proceeds. 
                // For simplicity here: Gain = (SellPrice * Qty) - (BuyPrice * Qty) - SellCommission - (BuyCommissionProrated?)
                // Let's stick to simple Gross P&L for now: (SellPrice - BuyAvg) * Qty. 

                // Refined Logic including commissions implicitly in prices if user provided net prices?
                // Let's calculate standard Raw P&L:
                const buyPriceAvg = costBasisTotal / qtySoldTotal;
                const gainAbs = (tx.price - buyPriceAvg) * qtySoldTotal;
                const gainPercent = (gainAbs / costBasisTotal) * 100;

                realizedGains.push({
                    id: `gain-${tx.date.getTime()}-${Math.random()}`,
                    date: tx.date,
                    ticker,
                    quantity: qtySoldTotal,
                    sellPrice: tx.price,
                    buyPriceAvg: buyPriceAvg,
                    gainAbs,
                    gainPercent,
                    currency: tx.currency
                });

                totalGainAbs += gainAbs;
            }
        }
    }

    return { inventory, realizedGains, totalGainAbs };
}
