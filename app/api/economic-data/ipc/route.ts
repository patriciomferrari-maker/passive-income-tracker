import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { regenerateAllCashflows } from '@/lib/rentals';

export async function GET() {
    try {
        const ipcData = await prisma.economicIndicator.findMany({
            where: { type: 'IPC' },
            orderBy: {
                date: 'asc'
            }
        });

        return NextResponse.json(ipcData);
    } catch (error) {
        console.error('Error fetching IPC data:', error);
        return NextResponse.json({ error: 'Failed to fetch IPC data' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { date, value, bulk } = body;

        if (bulk && Array.isArray(bulk)) {
            // Bulk upload
            // Prepare data for bulk upload, ensuring dates are correctly formatted and marked as manual
            const parsedData = bulk.map((item: any) => {
                const d = new Date(item.date);
                // Force Noon UTC to avoid timezone shifts (consistency with other endpoints)
                d.setUTCHours(12, 0, 0, 0);
                return {
                    date: d,
                    value: parseFloat(item.value)
                };
            });

            // Check for existing entries first to prevent manual duplicates
            const months = parsedData.map(item => ({
                year: item.date.getFullYear(),
                month: item.date.getMonth()
            }));

            const existing = await prisma.economicIndicator.findMany({
                where: {
                    type: 'IPC',
                    OR: months.map(m => ({
                        date: {
                            gte: new Date(m.year, m.month, 1),
                            lt: new Date(m.year, m.month + 1, 1)
                        }
                    }))
                }
            });

            if (existing.length > 0) {
                const existingMonths = existing.map(e => {
                    const d = new Date(e.date);
                    return `${d.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}`;
                }).join(', ');
                throw new Error(`Ya existen entradas IPC para: ${existingMonths}. Elimínalas primero para actualizarlas.`);
            }

            const operations = parsedData.map(item => {
                return prisma.economicIndicator.create({
                    data: {
                        type: 'IPC',
                        date: item.date,
                        value: item.value,
                        isManual: true // Mark as manual entry
                    }
                });
            });

            const results = await prisma.$transaction(operations);

            await regenerateAllCashflows();

            // Check for contract adjustments immediately after manual IPC entry
            console.log('📧 Checking for contract adjustments after manual IPC bulk entry...');
            const { checkContractAdjustments } = await import('@/app/lib/contract-helper');
            await checkContractAdjustments();

            return NextResponse.json({ created: results.length, message: `Processed ${results.length} records` });
        } else {
            // Single entry
            // CRITICAL: Parse date correctly to avoid timezone issues
            // Extract year, month, day from the input date string
            const inputDate = new Date(date);
            const year = inputDate.getFullYear();
            const month = inputDate.getMonth(); // 0-indexed
            const day = inputDate.getDate();

            // Create date in UTC at noon to match bulk upload behavior
            // This ensures consistency regardless of user's timezone
            const ipcDate = new Date(Date.UTC(year, month, day, 12, 0, 0, 0));

            // Check if entry already exists for this month
            const startOfMonth = new Date(ipcDate.getFullYear(), ipcDate.getMonth(), 1);
            const endOfMonth = new Date(ipcDate.getFullYear(), ipcDate.getMonth() + 1, 1);

            const existing = await prisma.economicIndicator.findFirst({
                where: {
                    type: 'IPC',
                    date: {
                        gte: startOfMonth,
                        lt: endOfMonth
                    }
                }
            });

            if (existing) {
                const monthYear = ipcDate.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
                throw new Error(`Ya existe una entrada IPC para ${monthYear}. Elimínala primero para actualizarla.`);
            }

            const indicator = await prisma.economicIndicator.create({
                data: {
                    type: 'IPC',
                    date: ipcDate,
                    value: parseFloat(value),
                    isManual: true
                }
            });

            await regenerateAllCashflows();

            // Check for contract adjustments immediately after manual IPC entry
            console.log('📧 Checking for contract adjustments after manual IPC entry...');
            const { checkContractAdjustments } = await import('@/app/lib/contract-helper');
            await checkContractAdjustments();

            return NextResponse.json(indicator);
        }
    } catch (error) {
        console.error('Error creating IPC data:', error);
        return NextResponse.json({ error: 'Failed to create IPC data' }, { status: 500 });
    }
}
