import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { getUserId, unauthorized } from '@/app/lib/auth-helper';

export async function GET() {
    try {
        const userId = await getUserId();
        const categories = await prisma.costaCategory.findMany({
            where: { userId },
            orderBy: { name: 'asc' }
        });
        return NextResponse.json(categories);
    } catch (error) {
        return unauthorized();
    }
}

export async function POST(request: Request) {
    try {
        const userId = await getUserId();
        const { name, type } = await request.json();
        const newCat = await prisma.costaCategory.create({
            data: { userId, name, type }
        });
        return NextResponse.json(newCat);
    } catch (error) {
        return unauthorized();
    }
}

export async function PUT(request: Request) {
    try {
        const userId = await getUserId();
        const { id, name, type } = await request.json();

        // Ownership check
        const existing = await prisma.costaCategory.findFirst({ where: { id, userId } });
        if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

        const updated = await prisma.costaCategory.update({
            where: { id },
            data: { name, type }
        });
        return NextResponse.json(updated);
    } catch (error) {
        return unauthorized();
    }
}

export async function DELETE(request: Request) {
    try {
        const userId = await getUserId();
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

        // Ownership check
        const existing = await prisma.costaCategory.findFirst({ where: { id, userId } });
        if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

        await prisma.costaCategory.delete({ where: { id } });
        return NextResponse.json({ success: true });
    } catch (error) {
        return unauthorized();
    }
}
