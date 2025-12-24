import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { getUserId, unauthorized } from '@/app/lib/auth-helper';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        // Check authentication directly to handle timezone errors gracefully
        let session;
        try {
            const { auth } = await import('@/auth');
            session = await auth();
        } catch (authError) {
            console.error('[Dashboard Stats] Auth check failed:', authError);
            // If auth itself fails (timezone or other issues), treat as unauthenticated
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userId = session.user.id;
        const now = new Date();

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, email: true } // Only select what we need
        });

        // Get User Settings
        const settings = await prisma.appSettings.findUnique({
            where: { userId },
            select: { userId: true, enabledSections: true, reportDay: true, reportHour: true }
        });

        let enabledSections = settings?.enabledSections ? settings.enabledSections.split(',') : [];

        // STRICT ACCESS CONTROL
        // Only allow 'barbosa' and 'costa' for the specific admin email
        const ADMIN_EMAIL = 'patriciomferrari@gmail.com';
        if (user?.email !== ADMIN_EMAIL) {
            enabledSections = enabledSections.filter(s => s !== 'barbosa' && s !== 'costa' && s !== 'costa-esmeralda');
        }

        const exchangeRate = 1160; // Hardcoded for now to avoid economicIndicator query
        const costaExchangeRate = 1160;

        // Get simple counts without detailed queries to avoid date issues
        const onCount = await prisma.investment.count({ where: { type: 'ON', userId } });
        const treasuryCount = await prisma.investment.count({ where: { type: 'TREASURY', userId } });
        const debtsCount = await prisma.debt.count({ where: { userId } });
        const rentalsCount = await prisma.contract.count({ where: { property: { userId } } });
        const bankCount = await prisma.bankOperation.count({ where: { userId } });

        const needsOnboarding = settings && settings.enabledSections === '';

        return NextResponse.json({
            needsOnboarding,
            enabledSections,
            userEmail: user?.email,
            on: {
                count: onCount,
                totalInvested: 0 // Simplified
            },
            treasury: {
                count: treasuryCount,
                totalInvested: 0
            },
            debts: {
                count: debtsCount,
                totalPending: 0
            },
            rentals: {
                count: rentalsCount,
                totalValue: 0
            },
            bank: {
                totalUSD: 0,
                nextMaturitiesPF: []
            },
            barbosa: {
                count: 0,
                totalMonthly: 0,
                label: 'Mes Actual',
                monthName: 'Diciembre'
            },
            costa: {
                count: 0,
                totalMonthly: 0,
                label: 'Mes Actual',
                monthName: 'Diciembre'
            }
        });
    } catch (error: any) {
        console.error('CRITICAL ERROR in /api/dashboard/stats:', error);
        return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
    }
}
