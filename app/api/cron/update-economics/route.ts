import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
    const results = {
        blue: { success: false, message: '' },
        ipc: { success: false, message: '' }
    };

    // 1. Update Dolar Blue (Daily)
    try {
        const response = await fetch('https://dolarapi.com/v1/dolares/blue');

        if (response.ok) {
            const data = await response.json();
            const rate = data.venta;

            // Normalize to first day of current month for "Monthly Avg" logic 
            // OR keep daily if we change schema? 
            // Current schema (EconomicIndicator) is unique by [type, date]. 
            // We usually store one value per month for simplicity in projections, 
            // BUT for daily tracking it's better to store today's date.
            // However, the existing 'fetch-blue' logic stores to the "first day of month".
            // Let's stick to "first day of month" updates to avoid flooding DB 
            // and keeping consistent with current logic which updates the SAME record for the month.
            // If the user wants daily history, we should change that, but for now we update the current month's value.

            const today = new Date();
            const monthDate = new Date(today.getFullYear(), today.getMonth(), 1);

            const existing = await prisma.economicIndicator.findFirst({
                where: { type: 'TC_USD_ARS', date: monthDate }
            });

            if (existing) {
                await prisma.economicIndicator.update({
                    where: { id: existing.id },
                    data: { value: rate }
                });
                results.blue = { success: true, message: `Updated rate to ${rate} for ${monthDate.toISOString().split('T')[0]}` };
            } else {
                await prisma.economicIndicator.create({
                    data: {
                        type: 'TC_USD_ARS',
                        date: monthDate,
                        value: rate
                    }
                });
                results.blue = { success: true, message: `Created rate ${rate} for ${monthDate.toISOString().split('T')[0]}` };
            }
        } else {
            results.blue = { success: false, message: 'DolarAPI returned error' };
        }
    } catch (error) {
        console.error('Cron Economics Blue Error:', error);
        results.blue = { success: false, message: error instanceof Error ? error.message : 'Unknown error' };
    }

    // 2. Check IPC (Inflation) - Manual for now, just logging status
    // TODO: Connect to an API if one becomes available
    try {
        const today = new Date();
        // Check if we have IPC for LAST month (usually released around 15th of current month)
        // e.g. In May, we check for April's IPC.
        const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);

        const hasIPC = await prisma.economicIndicator.findFirst({
            where: { type: 'IPC', date: lastMonth }
        });

        if (hasIPC) {
            results.ipc = { success: true, message: 'IPC for last month exists.' };
        } else {
            results.ipc = { success: false, message: 'IPC for last month NOT found. Manual upload required.' };
        }

    } catch (error) {
        console.error('Cron Economics IPC Error:', error);
        results.ipc = { success: false, message: 'Error checking IPC' };
    }

    return NextResponse.json({
        success: true,
        summary: results,
        timestamp: new Date().toISOString()
    });
}
