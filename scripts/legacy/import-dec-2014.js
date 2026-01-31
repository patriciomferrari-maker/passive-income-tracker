const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const dec2014Data = [["Fecha", "Compra", "Venta"], ["30/12/2014", "13,70", "13,80"], ["29/12/2014", "13,45", "13,55"], ["23/12/2014", "13,28", "13,38"], ["22/12/2014", "13,08", "13,18"], ["19/12/2014", "13,00", "13,10"], ["18/12/2014", "13,05", "13,15"], ["17/12/2014", "13,00", "13,10"], ["16/12/2014", "13,05", "13,15"], ["15/12/2014", "13,07", "13,17"], ["12/12/2014", "12,75", "12,85"], ["11/12/2014", "12,60", "12,70"], ["10/12/2014", "12,68", "12,78"], ["09/12/2014", "12,70", "12,80"], ["05/12/2014", "12,68", "12,78"], ["04/12/2014", "12,82", "12,92"], ["03/12/2014", "12,95", "13,05"], ["02/12/2014", "12,90", "13,00"], ["01/12/2014", "13,00", "13,10"]];

async function importDec2014() {
    console.log('Importing TC Blue for Dec 2014...\n');

    let created = 0;
    let skipped = 0;

    for (let i = 1; i < dec2014Data.length; i++) {
        const [dateStr, compraStr, ventaStr] = dec2014Data[i];

        // Parse DD/MM/YYYY
        const [day, month, year] = dateStr.split('/');
        const date = new Date(`${year}-${month}-${day}T12:00:00Z`);

        // Parse values
        const compra = parseFloat(compraStr.replace(',', '.'));
        const venta = parseFloat(ventaStr.replace(',', '.'));
        const value = (compra + venta) / 2;

        // Check if exists
        const dayStart = new Date(date);
        dayStart.setUTCHours(0, 0, 0, 0);
        const dayEnd = new Date(date);
        dayEnd.setUTCHours(23, 59, 59, 999);

        const existing = await prisma.economicIndicator.findFirst({
            where: {
                type: 'TC_USD_ARS',
                date: { gte: dayStart, lte: dayEnd }
            }
        });

        if (existing) {
            skipped++;
        } else {
            await prisma.economicIndicator.create({
                data: {
                    type: 'TC_USD_ARS',
                    date,
                    value,
                    buyRate: compra,
                    sellRate: venta
                }
            });
            created++;
        }
    }

    console.log(`✅ Dec 2014 import complete:`);
    console.log(`  Created: ${created}`);
    console.log(`  Skipped: ${skipped}`);

    await prisma.$disconnect();
}

importDec2014();
