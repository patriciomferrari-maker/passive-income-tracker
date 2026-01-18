import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/admin/ipc
 * Fetch IPC history with optional filtering
 * Note: Admin page is protected, so we don't need additional auth here
 */
export async function GET(req: NextRequest) {
    try {
        // Get query parameters
        const { searchParams } = new URL(req.url);
        const limit = parseInt(searchParams.get('limit') || '24');

        // Fetch IPC records
        const indicators = await prisma.economicIndicator.findMany({
            where: { type: 'IPC' },
            orderBy: { date: 'desc' },
            take: limit,
            select: {
                id: true,
                type: true,
                date: true,
                value: true,
                interannualValue: true,
                createdAt: true,
                updatedAt: true
            }
        });

        const total = await prisma.economicIndicator.count({ where: { type: 'IPC' } });

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
 * Note: Admin page is protected, so we don't need additional auth here
 */
export async function POST(req: NextRequest) {
    try {
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

        // Count affected contracts
        const affectedContracts = await prisma.contract.count({
            where: { adjustmentType: 'IPC' }
        });

        return NextResponse.json({
            success: true,
            indicator,
            message: `IPC value for ${normalizedDate.toISOString().slice(0, 7)} saved successfully`,
            affectedContracts,
            reminder: 'Run "npx tsx scripts/separate-regenerate.ts" to recalculate rentals'
        });

    } catch (error: any) {
        console.error('[API] Error saving IPC value:', error);
        return NextResponse.json(
            { error: 'Failed to save IPC value', details: error.message },
            { status: 500 }
        );
    }
}
