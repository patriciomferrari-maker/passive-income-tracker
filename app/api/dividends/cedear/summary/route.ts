import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { getUserId, unauthorized } from '@/app/lib/auth-helper';
import { getUserActiveTickers } from '@/app/lib/holdings-helper';

export const dynamic = 'force-dynamic';

// GET - Get dividend summary and aggregations
export async function GET(request: Request) {
    try {
        const userId = await getUserId();
        if (!userId) return unauthorized();

        const { searchParams } = new URL(request.url);
        const year = searchParams.get('year');
        const onlyHoldings = searchParams.get('onlyHoldings') === 'true';

        // Get all dividends with amounts
        const where: any = {
            amount: { not: null }
        };

        if (onlyHoldings) {
            const activeTickers = await getUserActiveTickers(userId);
            where.ticker = { in: activeTickers };
        }

        if (year) {
            const yearNum = parseInt(year);
            where.announcementDate = {
                gte: new Date(`${yearNum}-01-01`),
                lt: new Date(`${yearNum + 1}-01-01`)
            };
        }

        const dividends = await prisma.cedearDividend.findMany({
            where,
            orderBy: { announcementDate: 'desc' }
        });

        // Calculate totals
        const totalAmount = dividends.reduce((sum, d) => sum + (d.amount || 0), 0);

        // Group by ticker
        const byTicker: Record<string, { total: number; count: number; companyName: string }> = {};
        dividends.forEach(d => {
            if (!byTicker[d.ticker]) {
                byTicker[d.ticker] = { total: 0, count: 0, companyName: d.companyName };
            }
            byTicker[d.ticker].total += d.amount || 0;
            byTicker[d.ticker].count += 1;
        });

        // Group by month
        const byMonth: Record<string, number> = {};
        dividends.forEach(d => {
            const month = d.announcementDate.toISOString().substring(0, 7); // YYYY-MM
            byMonth[month] = (byMonth[month] || 0) + (d.amount || 0);
        });

        // Group by year
        const byYear: Record<string, number> = {};
        dividends.forEach(d => {
            const year = d.announcementDate.getFullYear().toString();
            byYear[year] = (byYear[year] || 0) + (d.amount || 0);
        });

        // Get current year and month totals
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1;

        const thisYearTotal = dividends
            .filter(d => d.announcementDate.getFullYear() === currentYear)
            .reduce((sum, d) => sum + (d.amount || 0), 0);

        const thisMonthTotal = dividends
            .filter(d =>
                d.announcementDate.getFullYear() === currentYear &&
                d.announcementDate.getMonth() + 1 === currentMonth
            )
            .reduce((sum, d) => sum + (d.amount || 0), 0);

        // Find top paying ticker
        const topTicker = Object.entries(byTicker)
            .sort(([, a], [, b]) => b.total - a.total)[0];

        return NextResponse.json({
            summary: {
                totalAmount,
                totalCount: dividends.length,
                thisYearTotal,
                thisMonthTotal,
                topTicker: topTicker ? {
                    ticker: topTicker[0],
                    companyName: topTicker[1].companyName,
                    total: topTicker[1].total,
                    count: topTicker[1].count
                } : null
            },
            byTicker: Object.entries(byTicker).map(([ticker, data]) => ({
                ticker,
                companyName: data.companyName,
                total: data.total,
                count: data.count
            })).sort((a, b) => b.total - a.total),
            byMonth: Object.entries(byMonth).map(([month, total]) => ({
                month,
                total
            })).sort((a, b) => a.month.localeCompare(b.month)),
            byYear: Object.entries(byYear).map(([year, total]) => ({
                year,
                total
            })).sort((a, b) => a.year.localeCompare(b.year))
        });
    } catch (error) {
        console.error('Error fetching dividend summary:', error);
        return unauthorized();
    }
}
