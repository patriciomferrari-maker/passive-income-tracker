import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import RentalsDashboardPrint from './RentalsDashboardPrint';

export const dynamic = 'force-dynamic';

interface PageProps {
    params: Promise<{ userId: string }>;
    searchParams: Promise<{ secret?: string }>;
}

async function getDashboardData(userId: string) {
    const now = new Date();

    const allContracts = await prisma.contract.findMany({
        where: {
            property: { userId }
        },
        include: {
            property: true
        }
    });

    const activeContracts = allContracts.filter(c => {
        const start = new Date(c.startDate);
        const end = new Date(start);
        end.setMonth(end.getMonth() + c.durationMonths);
        return start <= now && end >= now;
    });

    const dashboardData = await Promise.all(activeContracts.map(async (contract) => {
        const cashflows = await prisma.rentalCashflow.findMany({
            where: {
                contractId: contract.id
            },
            orderBy: {
                date: 'asc'
            }
        });

        const todayEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        const filteredCashflows = cashflows.filter(cf => cf.date <= todayEnd);

        const chartData = filteredCashflows.map(cf => ({
            date: cf.date.toISOString(),
            monthLabel: new Date(cf.date).toLocaleDateString('es-AR', { month: 'short', year: '2-digit' }),
            amountUSD: cf.amountUSD || 0,
            amountARS: cf.amountARS || 0,
            inflationAccum: cf.inflationAccum !== null ? (cf.inflationAccum * 100) : null,
            devaluationAccum: cf.devaluationAccum !== null ? (cf.devaluationAccum * 100) : null
        }));

        return {
            contractId: contract.id,
            propertyName: contract.property.name,
            tenantName: contract.tenantName,
            currency: contract.currency,
            initialRent: contract.initialRent,
            startDate: contract.startDate,
            durationMonths: contract.durationMonths,
            adjustmentType: contract.adjustmentType,
            adjustmentFrequency: contract.adjustmentFrequency,
            chartData,
            isConsolidated: contract.property.isConsolidated,
            propertyRole: (contract.property as any).role || 'OWNER'
        };
    }));

    return dashboardData;
}

async function getGlobalData(userId: string) {
    // Simplified version - you can expand this based on the actual global-dashboard API
    const contracts = await prisma.contract.findMany({
        where: { property: { userId } },
        include: { property: true }
    });

    // Return basic structure
    return {
        history: [],
        currencyDistribution: {
            owner: { USD: 0, ARS: 0 },
            tenant: { USD: 0, ARS: 0 }
        }
    };
}

export default async function PrintRentalsPage({ params, searchParams }: PageProps) {
    const { userId } = await params;
    const { secret } = await searchParams;

    if (secret !== process.env.CRON_SECRET) {
        return <div className="text-red-500 p-8">Unauthorized</div>;
    }

    const contractsData = await getDashboardData(userId);
    const globalData = await getGlobalData(userId);

    return (
        <RentalsDashboardPrint
            contractsData={contractsData}
            globalData={globalData}
        />
    );
}
