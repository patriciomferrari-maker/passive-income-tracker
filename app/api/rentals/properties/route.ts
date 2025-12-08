import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { getUserId, unauthorized } from '@/app/lib/auth-helper';

export async function GET() {
    try {
        const userId = await getUserId();
        const properties = await prisma.property.findMany({
            where: { userId },
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
        return unauthorized();
    }
}

export async function POST(request: Request) {
    try {
        const userId = await getUserId();
        const body = await request.json();
        const { name, address } = body;

        const property = await prisma.property.create({
            data: {
                userId,
                name,
                address: address || null
            }
        });

        return NextResponse.json(property);
    } catch (error) {
        console.error('Error creating property:', error);
        return unauthorized();
    }
}
