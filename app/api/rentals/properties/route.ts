import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET() {
    try {
        const properties = await prisma.property.findMany({
            include: {
                contracts: {
                    select: {
                        id: true,
                        tenantName: true,
                        startDate: true,
                        durationMonths: true,
                        currency: true,
                        initialRent: true
                    },
                    orderBy: {
                        startDate: 'desc'
                    }
                },
                _count: {
                    select: {
                        contracts: true
                    }
                }
            },
            orderBy: {
                name: 'asc'
            }
        });

        return NextResponse.json(properties);
    } catch (error) {
        console.error('Error fetching properties:', error);
        return NextResponse.json({ error: 'Failed to fetch properties' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { name, address } = body;

        const property = await prisma.property.create({
            data: {
                name,
                address: address || null
            }
        });

        return NextResponse.json(property);
    } catch (error) {
        console.error('Error creating property:', error);
        return NextResponse.json({ error: 'Failed to create property' }, { status: 500 });
    }
}
