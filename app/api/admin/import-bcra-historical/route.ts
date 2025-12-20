import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface BCRARecord {
    type: string;
    date: string;
    value: number;
    interannualValue?: number | null;
}

/**
 * Import BCRA historical data to production database
 * This is a one-time migration endpoint
 * DELETE THIS FILE AFTER MIGRATION IS COMPLETE
 */
export async function POST(request: Request) {
    try {
        const { data, secretKey } = await request.json();

        // Simple security check
        if (secretKey !== process.env.MIGRATION_SECRET) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        if (!Array.isArray(data)) {
            return NextResponse.json(
                { error: 'Invalid data format' },
                { status: 400 }
            );
        }

        console.log(`📥 Starting import of ${data.length} records...`);

        let created = 0;
        let updated = 0;
        let skipped = 0;
        let errors = 0;

        // Process in batches to avoid timeouts
        const batchSize = 100;
        for (let i = 0; i < data.length; i += batchSize) {
            const batch = data.slice(i, i + batchSize);

            for (const record of batch as BCRARecord[]) {
                try {
                    const date = new Date(record.date);

                    // Check if record exists
                    const existing = await prisma.economicIndicator.findUnique({
                        where: {
                            type_date: {
                                type: record.type,
                                date: date
                            }
                        }
                    });

                    if (existing) {
                        // Check if update needed
                        const needsUpdate =
                            existing.value !== record.value ||
                            existing.interannualValue !== record.interannualValue;

                        if (needsUpdate) {
                            await prisma.economicIndicator.update({
                                where: { id: existing.id },
                                data: {
                                    value: record.value,
                                    interannualValue: record.interannualValue
                                }
                            });
                            updated++;
                        } else {
                            skipped++;
                        }
                    } else {
                        // Create new record
                        await prisma.economicIndicator.create({
                            data: {
                                type: record.type,
                                date: date,
                                value: record.value,
                                interannualValue: record.interannualValue
                            }
                        });
                        created++;
                    }
                } catch (error) {
                    console.error(`Error processing record:`, record, error);
                    errors++;
                }
            }

            console.log(`Progress: ${Math.min(i + batchSize, data.length)}/${data.length}`);
        }

        console.log('✅ Import complete');
        console.log(`  - Created: ${created}`);
        console.log(`  - Updated: ${updated}`);
        console.log(`  - Skipped: ${skipped}`);
        console.log(`  - Errors: ${errors}`);

        return NextResponse.json({
            success: true,
            stats: { created, updated, skipped, errors },
            message: `Imported ${created + updated} records successfully`
        });

    } catch (error) {
        console.error('Import failed:', error);
        return NextResponse.json(
            {
                error: 'Import failed',
                details: error instanceof Error ? error.message : String(error)
            },
            { status: 500 }
        );
    }
}
