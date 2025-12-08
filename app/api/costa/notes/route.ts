import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { getUserId, unauthorized } from '@/app/lib/auth-helper';

export async function GET() {
    try {
        const userId = await getUserId();
        const notes = await prisma.costaNote.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' }
        });
        return NextResponse.json(notes);
    } catch (error) {
        return unauthorized();
    }
}

export async function POST(request: Request) {
    try {
        const userId = await getUserId();
        const { content, category } = await request.json();
        const newNote = await prisma.costaNote.create({
            data: { userId, content, category, status: 'PENDING' }
        });
        return NextResponse.json(newNote);
    } catch (error) {
        return unauthorized();
    }
}

export async function PUT(request: Request) {
    try {
        const userId = await getUserId();
        const { id, status } = await request.json();

        // Ownership check
        const existing = await prisma.costaNote.findFirst({ where: { id, userId } });
        if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

        const updated = await prisma.costaNote.update({
            where: { id },
            data: { status }
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
        const existing = await prisma.costaNote.findFirst({ where: { id, userId } });
        if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

        await prisma.costaNote.delete({ where: { id } });
        return NextResponse.json({ success: true });
    } catch (error) {
        return unauthorized();
    }
}
