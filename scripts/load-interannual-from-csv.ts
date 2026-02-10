import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface CSVRow {
    yearMonth: string;
    interannual: number;
}

function parseCSV(filePath: string): CSVRow[] {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());

    return lines.map(line => {
        const [yearMonth, percentStr] = line.split(',');
        // Remove quotes and % sign, replace comma with dot for parsing
        const cleanPercent = percentStr.replace(/["'%]/g, '').replace(',', '.');
        const interannual = parseFloat(cleanPercent);

        return {
            yearMonth: yearMonth.trim(),
            interannual
        };
    });
}

async function main() {
    const csvPath = 'C:\\Users\\patri\\.gemini\\antigravity\\infla\\Inflacion Interanual - Hoja 1.csv';

    console.log('\n📊 Cargando datos de inflación interanual...\n');

    const data = parseCSV(csvPath);
    console.log(`Leídos ${data.length} registros del CSV`);

    let updated = 0;
    let notFound = 0;
    let errors = 0;

    for (const row of data) {
        try {
            const [year, month] = row.yearMonth.split('-').map(Number);

            // Calculate last day of month
            const lastDay = new Date(year, month, 0).getDate();
            const targetDate = new Date(Date.UTC(year, month - 1, lastDay, 12, 0, 0));

            // Find existing IPC record for this month
            const existing = await prisma.economicIndicator.findFirst({
                where: {
                    type: 'IPC',
                    date: {
                        gte: new Date(Date.UTC(year, month - 1, 1)),
                        lt: new Date(Date.UTC(year, month, 1))
                    }
                }
            });

            if (existing) {
                // Update with interannual value
                await prisma.economicIndicator.update({
                    where: { id: existing.id },
                    data: { interannualValue: row.interannual }
                });

                updated++;
                console.log(`✅ ${row.yearMonth}: ${row.interannual}% (mensual: ${existing.value}%)`);
            } else {
                notFound++;
                console.log(`⚠️  ${row.yearMonth}: No se encontró registro mensual`);
            }
        } catch (error) {
            errors++;
            console.error(`❌ Error en ${row.yearMonth}:`, error);
        }
    }

    console.log('\n---');
    console.log(`✅ Actualizados: ${updated}`);
    console.log(`⚠️  No encontrados: ${notFound}`);
    console.log(`❌ Errores: ${errors}`);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
