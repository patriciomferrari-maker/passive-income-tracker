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
            // Bulk upload using transaction to allow updates (upsert)
            const operations = bulk.map((item: any) => {
                const date = new Date(item.date);
                // Force Noon UTC to avoid timezone shifts (consistency with other endpoints)
                date.setUTCHours(12, 0, 0, 0);

                return prisma.economicIndicator.upsert({
                    where: {
                        type_date: {
                            type: 'IPC',
                            date: date
                        }
                    },
                    update: {
                        value: parseFloat(item.value)
                    },
                    create: {
                        type: 'IPC',
                        date: date,
                        value: parseFloat(item.value)
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
            const indicator = await prisma.economicIndicator.upsert({
                where: {
                    type_date: {
                        type: 'IPC',
                        date: new Date(date)
                    }
                },
                update: {
                    value: parseFloat(value)
                },
                create: {
                    type: 'IPC',
                    date: new Date(date),
                    value: parseFloat(value)
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
