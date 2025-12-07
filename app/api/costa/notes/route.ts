import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET() {
    try {
        const notes = await prisma.costaNote.findMany({
            orderBy: { createdAt: 'desc' }
        });
        return NextResponse.json(notes);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch notes' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const { content, category } = await request.json();
        const newNote = await prisma.costaNote.create({
            data: { content, category, status: 'PENDING' }
        });
        return NextResponse.json(newNote);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to create note' }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const { id, status } = await request.json();
        const updated = await prisma.costaNote.update({
            where: { id },
            data: { status }
        });
        return NextResponse.json(updated);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to update note' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

        await prisma.costaNote.delete({ where: { id } });
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to delete note' }, { status: 500 });
    }
}
