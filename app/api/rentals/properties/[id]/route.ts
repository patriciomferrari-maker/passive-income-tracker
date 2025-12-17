import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const property = await prisma.property.findUnique({
            where: { id },
            include: {
                contracts: {
                    orderBy: {
                        startDate: 'desc'
                    }
                }
            }
        });

        if (!property) {
            return NextResponse.json({ error: 'Property not found' }, { status: 404 });
        }

        return NextResponse.json(property);
    } catch (error) {
        console.error('Error fetching property:', error);
        return NextResponse.json({ error: 'Failed to fetch property' }, { status: 500 });
    }
}

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();
        const { name, address, electricityId, gasId, municipalId, hasGarage, garageMunicipalId } = body;

        const property = await prisma.property.update({
            where: { id },
            data: {
                name,
                address: address || null,
                electricityId: electricityId || null,
                gasId: gasId || null,
                municipalId: municipalId || null,
                hasGarage: hasGarage || false,
                garageMunicipalId: garageMunicipalId || null,
                isConsolidated: body.isConsolidated !== undefined ? body.isConsolidated : true
            }
        });

        return NextResponse.json(property);
    } catch (error) {
        console.error('Error updating property:', error);
        return NextResponse.json({ error: 'Failed to update property' }, { status: 500 });
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        await prisma.property.delete({
            where: { id }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting property:', error);
        return NextResponse.json({ error: 'Failed to delete property' }, { status: 500 });
    }
}
