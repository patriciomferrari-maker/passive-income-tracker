import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Import historical TC Blue data in bulk
// Protected by secret key
export async function POST(request: Request) {
    try {
        // Auth check
        const authHeader = request.headers.get('authorization');
        const expectedSecret = process.env.ADMIN_SECRET || 'your-secret-key-here';

        if (authHeader !== `Bearer ${expectedSecret}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { records } = await request.json();

        if (!Array.isArray(records)) {
            return NextResponse.json({ error: 'records must be an array' }, { status: 400 });
        }

        console.log(`📥 Importing ${records.length} TC Blue records...`);

        let imported = 0;
        let skipped = 0;
        let errors = 0;

        for (const record of records) {
            try {
                const date = new Date(`${record.date}T12:00:00.000Z`);
                const avg = (record.buyRate + record.sellRate) / 2;

                await prisma.economicIndicator.upsert({
                    where: {
                        type_date: {
                            type: 'TC_USD_ARS',
                            date: date
                        }
                    },
                    update: {
                        value: avg,
                        buyRate: record.buyRate,
                        sellRate: record.sellRate
                    },
                    create: {
                        type: 'TC_USD_ARS',
                        date: date,
                        value: avg,
                        buyRate: record.buyRate,
                        sellRate: record.sellRate
                    }
                });

                imported++;
                if (imported % 100 === 0) {
                    console.log(`  Imported ${imported}/${records.length}...`);
                }
            } catch (error) {
                console.error(`Failed to import ${record.date}:`, error);
                errors++;
            }
        }

        console.log(`✅ Import complete: ${imported} imported, ${skipped} skipped, ${errors} errors`);

        return NextResponse.json({
            success: true,
            imported,
            skipped,
            errors
        });

    } catch (error) {
        console.error('❌ Error importing TC Blue data:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
