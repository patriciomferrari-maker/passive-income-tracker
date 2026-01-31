
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('Fixing ETF/CEDEAR Markets...');

    // 1. Ensure all CEDEARs are ARG
    const cedears = await prisma.investment.updateMany({
        where: { type: 'CEDEAR' },
        data: { market: 'ARG' }
    });
    console.log(`Updated ${cedears.count} CEDEARs to ARG.`);

    // 2. Find ETFs. If they have transactions in ARS, or explicitly ARS currency, set to ARG.
    // Also, force specific CEDEAR ETFs (SPY, QQQ, etc.) to ARG if they are found, 
    // to resolve visibility issues for users who manage them in Cartera Argentina.
    const etfs = await prisma.investment.findMany({
        where: { type: 'ETF' },
        include: { transactions: true }
    });

    for (const etf of etfs) {
        let isArg = false;

        // A. Check Currency (Explicit)
        if (etf.currency === 'ARS') isArg = true;

        // B. Check Transactions (Implicit)
        if (!isArg) {
            const hasArsTx = etf.transactions.some(tx => tx.currency === 'ARS' || tx.originalCurrency === 'ARS');
            if (hasArsTx) isArg = true;
        }

        // C. Force Known CEDEAR ETFs
        // These are frequently treated as Argentine investments (purchased as Cedears).
        // If the user has them in "Cartera USA", they might actually want them in "Cartera Argentina" 
        // if they are complaining about visibility.
        const argEtfTickers = ['SPY', 'QQQ', 'ARKK', 'DIA', 'EEM', 'XLF', 'XLE', 'IWM'];
        if (!isArg && argEtfTickers.includes(etf.ticker.toUpperCase())) {
            isArg = true;
            console.log(`Forcing ETF ${etf.ticker} to ARG (Known CEDEAR).`);
        }

        if (isArg) {
            await prisma.investment.update({
                where: { id: etf.id },
                data: { market: 'ARG' }
            });
            console.log(`Moved ETF ${etf.ticker} to ARG`);
        } else {
            console.log(`Keeping ETF ${etf.ticker} in US`);
        }
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
