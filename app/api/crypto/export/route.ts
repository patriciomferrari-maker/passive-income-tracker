import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { getUserId, unauthorized } from '@/app/lib/auth-helper';
import { calculateFIFO } from '@/app/lib/fifo';

export const dynamic = 'force-dynamic';

/**
 * Export all crypto transactions to CSV
 * Includes cost basis and P&L calculations using FIFO
 */
export async function GET() {
    try {
        const userId = await getUserId();

        // Get all crypto investments with transactions
        const cryptos = await prisma.investment.findMany({
            where: {
                userId,
                type: 'CRYPTO',
                market: 'CRYPTO'
            },
            include: {
                transactions: {
                    orderBy: { date: 'asc' }
                }
            }
        });

        // Build CSV data
        const csvRows = [];

        // Header
        csvRows.push([
            'Date',
            'Crypto',
            'Type',
            'Quantity',
            'Price (USD)',
            'Commission (USD)',
            'Total (USD)',
            'Cost Basis (USD)',
            'Realized P&L (USD)',
            'Notes'
        ].join(','));

        // Process each crypto
        for (const crypto of cryptos) {
            const fifoTxs = crypto.transactions.map(t => ({
                id: t.id,
                date: new Date(t.date),
                type: t.type as 'BUY' | 'SELL',
                quantity: t.quantity,
                price: t.price,
                commission: t.commission,
                currency: t.currency
            }));

            const fifoResult = calculateFIFO(fifoTxs, crypto.ticker);

            // Map transactions with FIFO data
            crypto.transactions.forEach(tx => {
                const realizedGain = fifoResult.realizedGains.find(g =>
                    g.sellDate.getTime() === new Date(tx.date).getTime() && tx.type === 'SELL'
                );

                const costBasis = realizedGain
                    ? ((realizedGain.buyPriceAvg * realizedGain.quantity) + realizedGain.buyCommissionPaid).toFixed(2)
                    : tx.type === 'BUY' ? Math.abs(tx.totalAmount).toFixed(2) : '';

                const realizedPnL = realizedGain ? realizedGain.gainAbs.toFixed(2) : '';

                csvRows.push([
                    new Date(tx.date).toISOString().split('T')[0],
                    crypto.ticker,
                    tx.type,
                    tx.quantity,
                    tx.price,
                    tx.commission,
                    Math.abs(tx.totalAmount).toFixed(2),
                    costBasis,
                    realizedPnL,
                    `"${(tx.notes || '').replace(/"/g, '""')}"`  // Escape quotes
                ].join(','));
            });
        }

        const csvContent = csvRows.join('\n');
        const filename = `crypto_transactions_${new Date().toISOString().split('T')[0]}.csv`;

        return new NextResponse(csvContent, {
            headers: {
                'Content-Type': 'text/csv',
                'Content-Disposition': `attachment; filename="${filename}"`
            }
        });
    } catch (error) {
        console.error('Error exporting crypto transactions:', error);

        if (error instanceof Error && error.message === 'Unauthorized') {
            return unauthorized();
        }

        return NextResponse.json(
            { error: 'Failed to export transactions' },
            { status: 500 }
        );
    }
}
