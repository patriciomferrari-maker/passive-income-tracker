import { prisma } from '../lib/prisma';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Export BCRA historical data to JSON for migration to production
 */
async function exportBCRAHistorical() {
    console.log('🔄 Exporting BCRA historical data...');

    try {
        // Get all BCRA economic indicators (IPC, UVA, TC_OFICIAL)
        const data = await prisma.economicIndicator.findMany({
            where: {
                type: {
                    in: ['IPC', 'UVA', 'TC_OFICIAL']
                }
            },
            orderBy: [
                { type: 'asc' },
                { date: 'asc' }
            ],
            select: {
                type: true,
                date: true,
                value: true,
                interannualValue: true
            }
        });

        console.log(`📊 Found ${data.length} records:`);

        // Count by type
        const byType = data.reduce((acc, item) => {
            acc[item.type] = (acc[item.type] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        Object.entries(byType).forEach(([type, count]) => {
            console.log(`  - ${type}: ${count} records`);
        });

        // Convert dates to ISO strings for JSON serialization
        const exportData = data.map(item => ({
            ...item,
            date: item.date.toISOString()
        }));

        // Write to file
        const outputPath = path.join(__dirname, '..', 'bcra-historical-export.json');
        fs.writeFileSync(outputPath, JSON.stringify(exportData, null, 2));

        console.log(`✅ Export complete: ${outputPath}`);
        console.log(`📦 Total records: ${data.length}`);
        console.log(`📏 File size: ${(fs.statSync(outputPath).size / 1024 / 1024).toFixed(2)} MB`);

    } catch (error) {
        console.error('❌ Export failed:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

exportBCRAHistorical();
