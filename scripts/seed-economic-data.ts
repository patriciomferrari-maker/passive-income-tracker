import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface ParsedData {
    date: Date;
    value: number;
    interannualValue?: number;
}

/**
 * Parse tab-separated file with format:
 * Fecha\tValor
 * DD/MM/YYYY\tNUMBER
 */
function parseFile(filePath: string, type: string): ParsedData[] {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());

    const data: ParsedData[] = [];

    // Skip header
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const [dateStr, valueStr] = line.split('\t');
        if (!dateStr || !valueStr) continue;

        // Parse date DD/MM/YYYY
        const [day, month, year] = dateStr.split('/').map(Number);
        if (!day || !month || !year) continue;

        // Create date at noon UTC to avoid timezone issues
        const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));

        // Parse value - handle Argentine format (comma as decimal separator)
        const cleanValue = valueStr.replace(/\./g, '').replace(',', '.');
        const value = parseFloat(cleanValue);

        if (!isNaN(value)) {
            data.push({ date, value });
        }
    }

    console.log(`✓ Parsed ${data.length} records from ${path.basename(filePath)}`);
    return data;
}

/**
 * Merge monthly and interannual IPC data
 */
function mergeIPCData(monthlyData: ParsedData[], interannualData: ParsedData[]): ParsedData[] {
    const merged = new Map<string, ParsedData>();

    // Add monthly data
    monthlyData.forEach(item => {
        const key = item.date.toISOString();
        merged.set(key, { ...item });
    });

    // Add interannual values
    interannualData.forEach(item => {
        const key = item.date.toISOString();
        const existing = merged.get(key);
        if (existing) {
            existing.interannualValue = item.value;
        } else {
            merged.set(key, { date: item.date, value: 0, interannualValue: item.value });
        }
    });

    return Array.from(merged.values());
}

async function seedEconomicData() {
    console.log('🌱 Starting economic data seeding...\n');

    const basePath = 'C:\\Users\\patri\\.gemini\\antigravity\\Bases';

    let totalCreated = 0;
    let totalUpdated = 0;
    let totalSkipped = 0;

    try {
        // 1. IPC (Monthly + Interannual)
        console.log('📊 Processing IPC data...');
        const ipcMensual = parseFile(path.join(basePath, 'IPC Mes.txt'), 'IPC');
        const ipcInteranual = parseFile(path.join(basePath, 'IPC Interanual.txt'), 'IPC');
        const ipcMerged = mergeIPCData(ipcMensual, ipcInteranual);

        for (const item of ipcMerged) {
            try {
                const existing = await prisma.economicIndicator.findUnique({
                    where: { type_date: { type: 'IPC', date: item.date } }
                });

                if (existing) {
                    // Skip if value was manually entered
                    if (existing.isManual) {
                        console.log(`⚠️  Skipping ${item.date.toISOString().slice(0, 10)} - manually entered`);
                        totalSkipped++;
                        continue;
                    }

                    // Update if values changed
                    if (existing.value !== item.value || existing.interannualValue !== item.interannualValue) {
                        await prisma.economicIndicator.update({
                            where: { id: existing.id },
                            data: {
                                value: item.value,
                                interannualValue: item.interannualValue
                            }
                        });
                        totalUpdated++;
                    } else {
                        totalSkipped++;
                    }
                } else {
                    await prisma.economicIndicator.create({
                        data: {
                            type: 'IPC',
                            date: item.date,
                            value: item.value,
                            interannualValue: item.interannualValue,
                            isManual: false  // Mark as automatic
                        }
                    });
                    totalCreated++;
                }
            } catch (error) {
                console.error(`Error processing IPC for ${item.date.toISOString()}:`, error);
            }
        }
        console.log(`✓ IPC: Created ${totalCreated}, Updated ${totalUpdated}, Skipped ${totalSkipped}\n`);

        // 2. UVA
        console.log('💰 Processing UVA data...');
        const uvaData = parseFile(path.join(basePath, 'Valor UVA.txt'), 'UVA');
        let uvaCreated = 0, uvaUpdated = 0, uvaSkipped = 0;

        for (const item of uvaData) {
            try {
                const result = await prisma.economicIndicator.upsert({
                    where: { type_date: { type: 'UVA', date: item.date } },
                    update: { value: item.value },
                    create: {
                        type: 'UVA',
                        date: item.date,
                        value: item.value
                    }
                });

                if (result.createdAt.getTime() === result.updatedAt.getTime()) {
                    uvaCreated++;
                } else {
                    uvaUpdated++;
                }
            } catch (error) {
                console.error(`Error processing UVA for ${item.date.toISOString()}:`, error);
            }
        }
        console.log(`✓ UVA: Created ${uvaCreated}, Updated ${uvaUpdated}\n`);

        // 3. TC Oficial
        console.log('💵 Processing TC Oficial data...');
        const tcData = parseFile(path.join(basePath, 'TC Oficial.txt'), 'TC_OFICIAL');
        let tcCreated = 0, tcUpdated = 0;

        for (const item of tcData) {
            try {
                const result = await prisma.economicIndicator.upsert({
                    where: { type_date: { type: 'TC_OFICIAL', date: item.date } },
                    update: { value: item.value },
                    create: {
                        type: 'TC_OFICIAL',
                        date: item.date,
                        value: item.value
                    }
                });

                if (result.createdAt.getTime() === result.updatedAt.getTime()) {
                    tcCreated++;
                } else {
                    tcUpdated++;
                }
            } catch (error) {
                console.error(`Error processing TC for ${item.date.toISOString()}:`, error);
            }
        }
        console.log(`✓ TC Oficial: Created ${tcCreated}, Updated ${tcUpdated}\n`);

        console.log('✅ Seeding completed successfully!');
        console.log(`\nSummary:`);
        console.log(`  Total Created: ${totalCreated + uvaCreated + tcCreated}`);
        console.log(`  Total Updated: ${totalUpdated + uvaUpdated + tcUpdated}`);
        console.log(`  Total Skipped: ${totalSkipped}`);

    } catch (error) {
        console.error('❌ Error during seeding:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

// Run if called directly
if (require.main === module) {
    seedEconomicData()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error(error);
            process.exit(1);
        });
}

export { seedEconomicData };
