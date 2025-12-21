import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * Admin endpoint to clean duplicate IPC entries
 * Keeps the last day of each month, removes others
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { dryRun = true, confirm = false } = body;

        // Safety check: require explicit confirmation for actual deletion
        if (!dryRun && !confirm) {
            return NextResponse.json({
                error: 'Confirmation required',
                message: 'Set confirm: true to proceed with deletion'
            }, { status: 400 });
        }

        // Fetch all IPC records
        const allRecords = await prisma.economicIndicator.findMany({
            where: { type: 'IPC' },
            orderBy: { date: 'asc' }
        });

        console.log(`[Cleanup] Total IPC records: ${allRecords.length}`);

        // Group by year-month
        const byMonth = new Map<string, typeof allRecords>();
        allRecords.forEach(record => {
            const monthKey = record.date.toISOString().slice(0, 7); // YYYY-MM
            if (!byMonth.has(monthKey)) {
                byMonth.set(monthKey, []);
            }
            byMonth.get(monthKey)!.push(record);
        });

        // Find duplicates
        const duplicateMonths: Array<{
            monthKey: string;
            records: typeof allRecords;
            keep: typeof allRecords[0];
            remove: typeof allRecords;
        }> = [];

        byMonth.forEach((records, monthKey) => {
            if (records.length > 1) {
                // Sort by date descending to keep the LAST day of the month
                records.sort((a, b) => b.date.getTime() - a.date.getTime());

                const keep = records[0]; // Keep the latest date
                const remove = records.slice(1); // Remove the rest

                duplicateMonths.push({
                    monthKey,
                    records,
                    keep,
                    remove
                });
            }
        });

        console.log(`[Cleanup] Found ${duplicateMonths.length} months with duplicates`);

        // Build detailed report
        const report = {
            totalRecords: allRecords.length,
            duplicateMonths: duplicateMonths.length,
            totalToDelete: duplicateMonths.reduce((sum, m) => sum + m.remove.length, 0),
            details: duplicateMonths.map(({ monthKey, keep, remove }) => ({
                month: monthKey,
                keep: {
                    date: keep.date.toISOString().slice(0, 10),
                    value: keep.value,
                    id: keep.id
                },
                remove: remove.map(r => ({
                    date: r.date.toISOString().slice(0, 10),
                    value: r.value,
                    id: r.id
                }))
            }))
        };

        // If dry run, just return the report
        if (dryRun) {
            return NextResponse.json({
                dryRun: true,
                message: 'Dry run completed - no changes made',
                report,
                next: 'Set dryRun: false and confirm: true to proceed with deletion'
            });
        }

        // Execute deletion
        const toDeleteIds = duplicateMonths.flatMap(m => m.remove.map(r => r.id));

        console.log(`[Cleanup] Deleting ${toDeleteIds.length} duplicate records...`);

        const deleteResult = await prisma.economicIndicator.deleteMany({
            where: {
                id: { in: toDeleteIds }
            }
        });

        console.log(`[Cleanup] Deleted ${deleteResult.count} records`);

        // Verify
        const remaining = await prisma.economicIndicator.count({
            where: { type: 'IPC' }
        });

        return NextResponse.json({
            success: true,
            message: 'Cleanup completed successfully',
            deleted: deleteResult.count,
            remaining,
            report
        });

    } catch (error) {
        console.error('[Cleanup] Error:', error);
        return NextResponse.json({
            error: 'Cleanup failed',
            message: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}

/**
 * GET endpoint for checking current duplicate status
 */
export async function GET() {
    try {
        // Quick check for duplicates
        const allRecords = await prisma.economicIndicator.findMany({
            where: { type: 'IPC' },
            select: { date: true, id: true }
        });

        const byMonth = new Map<string, number>();
        allRecords.forEach(record => {
            const monthKey = record.date.toISOString().slice(0, 7);
            byMonth.set(monthKey, (byMonth.get(monthKey) || 0) + 1);
        });

        const duplicateCount = Array.from(byMonth.values()).filter(count => count > 1).length;

        return NextResponse.json({
            totalRecords: allRecords.length,
            uniqueMonths: byMonth.size,
            duplicateMonths: duplicateCount,
            hasDuplicates: duplicateCount > 0
        });

    } catch (error) {
        console.error('[Cleanup Check] Error:', error);
        return NextResponse.json({
            error: 'Check failed',
            message: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
