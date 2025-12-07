import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET() {
    try {
        const tcData = await prisma.economicIndicator.findMany({
            where: { type: 'TC_USD_ARS' },
            orderBy: {
                date: 'asc'
            }
        });

        return NextResponse.json(tcData);
    } catch (error) {
        console.error('Error fetching TC data:', error);
        return NextResponse.json({ error: 'Failed to fetch TC data' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { date, value, bulk } = body;

        if (bulk && Array.isArray(bulk)) {
            // Bulk upload
            const data = bulk.map((item: any) => ({
                type: 'TC_USD_ARS',
                date: new Date(item.date),
                value: parseFloat(item.value),
                buyRate: item.buyRate ? parseFloat(item.buyRate) : undefined,
                sellRate: item.sellRate ? parseFloat(item.sellRate) : undefined
            }));

            await prisma.$transaction(
                data.map((item: any) =>
                    prisma.economicIndicator.upsert({
                        where: {
                            type_date: {
                                type: 'TC_USD_ARS',
                                date: item.date
                            }
                        },
                        update: {
                            value: item.value,
                            buyRate: item.buyRate,
                            sellRate: item.sellRate
                        },
                        create: item
                    })
                )
            );

            return NextResponse.json({ created: data.length });
        } else {
            // Single entry
            const { buyRate, sellRate } = body;

            const indicator = await prisma.economicIndicator.upsert({
                where: {
                    type_date: {
                        type: 'TC_USD_ARS',
                        date: new Date(date)
                    }
                },
                update: {
                    value: parseFloat(value),
                    buyRate: buyRate ? parseFloat(buyRate) : undefined,
                    sellRate: sellRate ? parseFloat(sellRate) : undefined
                },
                create: {
                    type: 'TC_USD_ARS',
                    date: new Date(date),
                    value: parseFloat(value),
                    buyRate: buyRate ? parseFloat(buyRate) : undefined,
                    sellRate: sellRate ? parseFloat(sellRate) : undefined
                }
            });

            return NextResponse.json(indicator);
        }
    } catch (error) {
        console.error('Error creating TC data:', error);
        return NextResponse.json({ error: 'Failed to create TC data' }, { status: 500 });
    }
}
