
import { prisma } from '@/lib/prisma';
import { getUserId, unauthorized } from '@/app/lib/auth-helper';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const userId = await getUserId();
        if (!userId) return unauthorized();

        // Admin Only Check
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { role: true }
        });

        if (user?.role !== 'ADMIN') {
            return unauthorized();
        }

        // Fetch Data
        const investments = await prisma.investment.findMany({
            include: { transactions: true }
        });

        // Convert to CSV
        const header = ["Type", "Ticker", "Name", "Market", "Currency", "Last Price", "Tx Date", "Tx Type", "Quantity", "Price", "Commission"].join(",");

        let csv = header + "\n";

        investments.forEach(inv => {
            if (inv.transactions.length === 0) {
                // Print Asset even if no tx
                csv += `${inv.type},${inv.ticker},"${inv.name}",${inv.market},${inv.currency},${inv.lastPrice},,,,,\n`;
            } else {
                inv.transactions.forEach(tx => {
                    const date = tx.date.toISOString().split('T')[0];
                    csv += `${inv.type},${inv.ticker},"${inv.name}",${inv.market},${inv.currency},${inv.lastPrice},${date},${tx.type},${tx.quantity},${tx.price},${tx.commission || 0}\n`;
                });
            }
        });

        // response
        return new NextResponse(csv, {
            status: 200,
            headers: {
                'Content-Type': 'text/csv',
                'Content-Disposition': `attachment; filename="backup_${new Date().toISOString().split('T')[0]}.csv"`,
            }
        });

    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
