import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { getUserId, unauthorized } from '@/app/lib/auth-helper';
import { getUserActiveTickers } from '@/app/lib/holdings-helper';

export const dynamic = 'force-dynamic';

// GET - List dividends with optional filters
export async function GET(request: Request) {
    try {
        const userId = await getUserId();
        if (!userId) return unauthorized();

        const { searchParams } = new URL(request.url);
        const ticker = searchParams.get('ticker');
        const year = searchParams.get('year');
        const month = searchParams.get('month');
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');
        const onlyHoldings = searchParams.get('onlyHoldings') === 'true';

        const where: any = {};

        if (onlyHoldings) {
            const activeTickers = await getUserActiveTickers(userId);
            where.ticker = { in: activeTickers };
        }

        if (ticker) {
            // If already filtering by holdings, we need to handle both
            if (where.ticker) {
                // Ticker must be in holdings AND match the search
                // But typically ticker search overrides, or we just intersection
                // Let's make search override if it's specific
                where.ticker = ticker;
            } else {
                where.ticker = ticker;
            }
        }

        if (year || month) {
            where.announcementDate = {};
            if (year) {
                const yearNum = parseInt(year);
                where.announcementDate.gte = new Date(`${yearNum}-01-01`);
                where.announcementDate.lt = new Date(`${yearNum + 1}-01-01`);
            }
            if (month && year) {
                const yearNum = parseInt(year);
                const monthNum = parseInt(month);
                where.announcementDate.gte = new Date(`${yearNum}-${monthNum.toString().padStart(2, '0')}-01`);
                const nextMonth = monthNum === 12 ? 1 : monthNum + 1;
                const nextYear = monthNum === 12 ? yearNum + 1 : yearNum;
                where.announcementDate.lt = new Date(`${nextYear}-${nextMonth.toString().padStart(2, '0')}-01`);
            }
        } else if (startDate || endDate) {
            where.announcementDate = {};
            if (startDate) {
                where.announcementDate.gte = new Date(startDate);
            }
            if (endDate) {
                where.announcementDate.lte = new Date(endDate);
            }
        }

        const dividends = await prisma.cedearDividend.findMany({
            where,
            orderBy: { announcementDate: 'desc' }
        });

        return NextResponse.json(dividends);
    } catch (error) {
        console.error('Error fetching dividends:', error);
        return unauthorized();
    }
}

// POST - Create new dividend
export async function POST(request: Request) {
    try {
        await getUserId(); // Verify authentication

        const body = await request.json();
        const {
            ticker,
            companyName,
            announcementDate,
            paymentDate,
            recordDate,
            exDate,
            amount,
            currency,
            pdfUrl,
            notes
        } = body;

        if (!ticker || !companyName || !announcementDate) {
            return NextResponse.json(
                { error: 'Ticker, company name, and announcement date are required' },
                { status: 400 }
            );
        }

        const dividend = await prisma.cedearDividend.create({
            data: {
                ticker,
                companyName,
                announcementDate: new Date(announcementDate),
                paymentDate: paymentDate ? new Date(paymentDate) : null,
                recordDate: recordDate ? new Date(recordDate) : null,
                exDate: exDate ? new Date(exDate) : null,
                amount: amount ? parseFloat(amount) : null,
                currency: currency || 'USD',
                pdfUrl: pdfUrl || null,
                notes: notes || null
            }
        });

        return NextResponse.json(dividend);
    } catch (error: any) {
        console.error('Error creating dividend:', error);

        // Handle unique constraint violation
        if (error.code === 'P2002') {
            return NextResponse.json(
                { error: 'A dividend with this ticker and announcement date already exists' },
                { status: 409 }
            );
        }

        return NextResponse.json(
            { error: 'Failed to create dividend' },
            { status: 500 }
        );
    }
}
