import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserId } from '@/app/lib/auth-helper';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const categories = await prisma.barbosaCategory.findMany({
        where: { userId },
        include: { subCategories: true }
    });

    return NextResponse.json(categories);
}

export async function POST(req: NextRequest) {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { name, type } = body;

    const cat = await prisma.barbosaCategory.create({
        data: { userId, name, type }
    });
    return NextResponse.json(cat);
}

export async function DELETE(req: NextRequest) {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const searchParams = req.nextUrl.searchParams;
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

    const cat = await prisma.barbosaCategory.findFirst({ where: { id, userId } });
    if (!cat) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Prisma handles cascade delete if configured, else manual:
    // We assume Cascade in schema or we delete subs here?
    // Let's rely on Schema relation "onDelete: Cascade" if present, or delete manual.
    // Safety check: Delete subcategories first manually to be sure.
    await prisma.barbosaSubCategory.deleteMany({ where: { categoryId: id } });
    await prisma.barbosaCategory.delete({ where: { id } });

    return NextResponse.json({ success: true });
}
