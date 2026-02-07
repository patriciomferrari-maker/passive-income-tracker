
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Mock FIFO (copied from app/lib/fifo.ts to be self-contained or imported)
// For simplicity, I'll import it if ts-node works, or copy-paste it.
// Let's assume we can run this with ts-node or just copy the logic.
// I will copy the logic to be safe and avoid import issues in a script.

function calculateFIFO(transactions, ticker) {
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
            if (a.createdAt && b.createdAt) {
                return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
            }
            return 0;
        });

    const inventory = [];
    const realizedGains = [];
    let totalGainAbs = 0;

    for (const tx of sorted) {
        if (tx.type === 'BUY') {
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
            let totalWeightedExchangeRate = 0;

            while (qtyToSell > 0 && inventory.length > 0) {
                const batch = inventory[0];
                if (batch.quantity <= qtyToSell) {
                    const batchCost = batch.quantity * batch.price;
                    const proratedComm = batch.originalQuantity > 0 ? (batch.quantity / batch.originalQuantity) * batch.originalCommission : 0;
                    costBasisTotal += batchCost;
                    buyCommissionConsumedTotal += proratedComm;
                    qtySoldTotal += batch.quantity;
                    totalWeightedExchangeRate += batch.quantity * batch.originalExchangeRate;
                    qtyToSell -= batch.quantity;
                    inventory.shift();
                } else {
                    const qtyConsumed = qtyToSell;
                    const batchCost = qtyConsumed * batch.price;
                    const proratedComm = batch.originalQuantity > 0 ? (qtyConsumed / batch.originalQuantity) * batch.originalCommission : 0;
                    costBasisTotal += batchCost;
                    buyCommissionConsumedTotal += proratedComm;
                    qtySoldTotal += qtyConsumed;
                    totalWeightedExchangeRate += qtyConsumed * batch.originalExchangeRate;
                    batch.quantity -= qtyConsumed;
                    qtyToSell = 0;
                }
            }

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
                    sellCommission,
                    buyPriceAvg,
                    buyCommissionPaid: buyCommissionConsumedTotal || 0,
                    gainAbs,
                    gainPercent,
                    currency: tx.currency,
                    buyExchangeRateAvg: isNaN(buyExchangeRateAvg) ? 1 : buyExchangeRateAvg
                });
                totalGainAbs += gainAbs;
            }
        }
    }

    const openPositions = inventory.map(item => {
        const proratedComm = item.originalQuantity > 0 ? (item.quantity / item.originalQuantity) * item.originalCommission : 0;
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
            buyExchangeRateAvg: item.originalExchangeRate,
            buyPriceOriginalAvg: item.originalUnitCostOriginalCurrency
        };
    });

    return { inventory, openPositions, realizedGains, totalGainAbs };
}


async function main() {
    try {
        const user = await prisma.user.findFirst();
        if (!user) {
            console.log('No user found');
            return;
        }
        const userId = user.id;
        console.log('Testing with User ID:', userId);

        const investments = await prisma.investment.findMany({
            where: { userId },
            include: { transactions: true }
        });

        console.log(`Found ${investments.length} investments`);

        for (const inv of investments) {
            console.log(`Processing ${inv.ticker}...`);
            const fifoTransactions = inv.transactions.map(t => ({
                id: t.id,
                date: t.date,
                type: t.type, // 'BUY' | 'SELL'
                quantity: t.quantity,
                price: t.price,
                currency: t.currency,
                exchangeRate: t.exchangeRate
            }));

            // Check for problematic values
            fifoTransactions.forEach(t => {
                // console.log(typeof t.price, t.price); 
                // If price is Decimal, Number(t.price) should work but let's check
            });

            const results = calculateFIFO(fifoTransactions, inv.ticker);
            console.log(`  Realized Gains: ${results.realizedGains.length}`);
            console.log(`  Open Positions: ${results.openPositions.length}`);
        }

        const userHoldings = await prisma.userHolding.findMany({
            where: { userId },
            include: { asset: true, transactions: true }
        });
        console.log(`Found ${userHoldings.length} userHoldings`);

        for (const holding of userHoldings) {
            console.log(`Processing Holding ${holding.asset.ticker}...`);
            const fifoTransactions = holding.transactions.map(t => ({
                id: t.id,
                date: t.date,
                type: t.type,
                quantity: t.quantity,
                price: t.price,
                currency: t.currency,
                exchangeRate: undefined // creating explicit undefined
            }));

            const results = calculateFIFO(fifoTransactions, holding.asset.ticker);
            console.log(`  Realized Gains: ${results.realizedGains.length}`);
            console.log(`  Open Positions: ${results.openPositions.length}`);
        }

        console.log('All done successfully');
    } catch (e) {
        console.error('CRASHED:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
