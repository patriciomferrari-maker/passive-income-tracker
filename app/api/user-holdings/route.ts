import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { getUserId, unauthorized } from '@/app/lib/auth-helper';
import { z } from 'zod';

const AddHoldingSchema = z.object({
    assetId: z.string().min(1)
});

export async function POST(request: Request) {
    try {
        const userId = await getUserId();
        const json = await request.json();
        const { assetId } = AddHoldingSchema.parse(json);

        // Check availability
        const asset = await prisma.globalAsset.findUnique({
            where: { id: assetId }
        });

        if (!asset) {
            return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
        }

        // Check if already exists
        const existing = await prisma.userHolding.findUnique({
            where: {
                userId_assetId: { userId, assetId }
            }
        });

        if (existing) {
            return NextResponse.json({ error: 'Already in portfolio' }, { status: 400 });
        }

        // Create holding
        const holding = await prisma.userHolding.create({
            data: {
                userId,
                assetId
            }
        });

        return NextResponse.json(holding);

    } catch (error) {
        console.error('Error adding holding:', error);
        return unauthorized();
    }
}

export async function DELETE(request: Request) {
    try {
        const userId = await getUserId();
        const { searchParams } = new URL(request.url);
        const assetId = searchParams.get('assetId');

        if (!assetId) {
            return NextResponse.json({ error: 'Missing assetId' }, { status: 400 });
        }

        // Verify ownership (holding exists for this user)
        const holding = await prisma.userHolding.findUnique({
            where: {
                userId_assetId: { userId, assetId }
            }
        });

        if (!holding) {
            return NextResponse.json({ error: 'Holding not found' }, { status: 404 });
        }

        // Delete holding
        await prisma.userHolding.delete({
            where: {
                userId_assetId: { userId, assetId }
            }
        });

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Error removing holding:', error);
        return unauthorized();
    }
}
