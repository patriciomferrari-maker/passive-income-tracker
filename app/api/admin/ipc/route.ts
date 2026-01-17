import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserId } from '@/lib/auth-helper';

/**
 * GET /api/admin/ipc
 * Fetch IPC history with optional filtering
 */
export async function GET(req: NextRequest) {
    try {
        const userId = await getUserId();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Check if user is admin
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { role: true }
        });

        if (user?.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden - Admin only' }, { status: 403 });
        }

        // Get query parameters
        const { searchParams } = new URL(req.url);
        const limit = parseInt(searchParams.get('limit') || '12');
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');

        // Build where clause
        const where: any = { type: 'IPC' };

        if (startDate || endDate) {
            where.date = {};
            if (startDate) where.date.gte = new Date(startDate);
            if (endDate) where.date.lte = new Date(endDate);
        }

        // Fetch IPC records
        const indicators = await prisma.economicIndicator.findMany({
            where,
            orderBy: { date: 'desc' },
            take: limit,
            select: {
                id: true,
                type: true,
                date: true,
                value: true,
                isManual: true,
                createdAt: true,
                updatedAt: true
            }
        });

        const total = await prisma.economicIndicator.count({ where });

        return NextResponse.json({
            success: true,
            indicators,
            total
        });

    } catch (error: any) {
        console.error('[API] Error fetching IPC data:', error);
        return NextResponse.json(
            { error: 'Failed to fetch IPC data', details: error.message },
            { status: 500 }
        );
    }
}

/**
 * POST /api/admin/ipc
 * Create or update an IPC value
 */
export async function POST(req: NextRequest) {
    try {
        const userId = await getUserId();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Check if user is admin
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { role: true }
        });

        if (user?.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden - Admin only' }, { status: 403 });
        }

        const body = await req.json();
        const { date, value } = body;

        // Validation
        if (!date || value === undefined || value === null) {
            return NextResponse.json(
                { error: 'Missing required fields: date, value' },
                { status: 400 }
            );
        }

        // Validate value range (-50% to 50%)
        if (value < -0.5 || value > 0.5) {
            return NextResponse.json(
                { error: 'IPC value must be between -50% and 50% (-0.5 to 0.5)' },
                { status: 400 }
            );
        }

        // Validate date is not in the future
        const inputDate = new Date(date);
        const now = new Date();
        if (inputDate > now) {
            return NextResponse.json(
                { error: 'Cannot set IPC for future dates' },
                { status: 400 }
            );
        }

        // Normalize date to first day of month (UTC)
        const normalizedDate = new Date(Date.UTC(
            inputDate.getUTCFullYear(),
            inputDate.getUTCMonth(),
            1
        ));

        // Upsert IPC value with isManual = true
        const indicator = await prisma.economicIndicator.upsert({
            where: {
                type_date: {
                    type: 'IPC',
                    date: normalizedDate
                }
            },
            update: {
                value,
                isManual: true,
                updatedAt: new Date()
            },
            create: {
                type: 'IPC',
                date: normalizedDate,
                value,
                isManual: true
            }
        });

        // Trigger rental recalculation asynchronously
        let affectedRentals = 0;
        try {
            const { recalculateRentalsForIPCChange } = await import('@/lib/rental-recalculator');
            affectedRentals = await recalculateRentalsForIPCChange(normalizedDate);
            console.log(`[IPC API] Recalculated ${affectedRentals} rental contracts`);
        } catch (recalcError: any) {
            console.error('[IPC API] Error recalculating rentals:', recalcError.message);
            // Don't fail the request if recalculation fails
        }

        return NextResponse.json({
            success: true,
            indicator,
            message: `IPC value for ${normalizedDate.toISOString().slice(0, 7)} saved successfully`,
            affectedRentals
        });

    } catch (error: any) {
        console.error('[API] Error saving IPC value:', error);
        return NextResponse.json(
            { error: 'Failed to save IPC value', details: error.message },
            { status: 500 }
        );
    }
}
